
const MINIMUM_ADVANCE_MINUTES = 60;
const FIRST_VALID_BOOKING_HOUR = 20;
const FIRST_VALID_BOOKING_MINUTE = 30;
const BOOKING_API_URL = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/prenota';

function pad2(value) {
    return String(value).padStart(2, '0');
}

function formatLocalDateTimeForInput(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function parseLocalDateTime(value) {
    if (typeof value !== 'string') return null;

    const trimmed = value.trim();
    if (!trimmed) return null;

    const [datePart, timePart] = trimmed.split('T');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    if ([year, month, day, hour, minute].some((part) => Number.isNaN(part))) {
        return null;
    }

    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getEarliestAllowedDateTime() {
    const now = new Date();
    const minAllowed = new Date(now.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);
    const firstAllowedToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        FIRST_VALID_BOOKING_HOUR,
        FIRST_VALID_BOOKING_MINUTE,
        0,
        0
    );

    return minAllowed < firstAllowedToday ? firstAllowedToday : minAllowed;
}

function validateBookingDateTime(value) {
    const selectedDateTime = parseLocalDateTime(value);
    if (!selectedDateTime || Number.isNaN(selectedDateTime.getTime())) {
        return 'Seleziona una data e un orario validi.';
    }

    const now = new Date();
    const minimumAllowed = new Date(now.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);

    if (selectedDateTime <= now) {
        return 'La data e l\'orario selezionati sono nel passato oppure già iniziati.';
    }

    if (selectedDateTime < minimumAllowed) {
        return `È necessario un anticipo minimo di ${MINIMUM_ADVANCE_MINUTES} minuti.`;
    }

    const selectedTotalMinutes = selectedDateTime.getHours() * 60 + selectedDateTime.getMinutes();
    const firstAllowedTotalMinutes = FIRST_VALID_BOOKING_HOUR * 60 + FIRST_VALID_BOOKING_MINUTE;

    if (selectedTotalMinutes < firstAllowedTotalMinutes) {
        return `La prima prenotazione valida è disponibile dalle ${String(FIRST_VALID_BOOKING_HOUR).padStart(2, '0')}:${String(FIRST_VALID_BOOKING_MINUTE).padStart(2, '0')}.`;
    }

    return '';
}

async function readErrorMessage(response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            const data = await response.json();
            return data.message || data.error || 'Errore durante la prenotazione.';
        } catch (error) {
            return 'Errore durante la prenotazione.';
        }
    }

    try {
        const text = await response.text();
        return text || 'Errore durante la prenotazione.';
    } catch (error) {
        return 'Errore durante la prenotazione.';
    }
}

const bookingForm = document.getElementById('bookingForm');
const dataOraInput = document.getElementById('dataOra');
const dateError = document.getElementById('dateError');

function updateBookingDateFeedback() {
    const message = validateBookingDateTime(dataOraInput.value);

    if (message) {
        dataOraInput.setCustomValidity(message);
        dateError.textContent = message;
        dateError.style.display = 'block';
    } else {
        dataOraInput.setCustomValidity('');
        dateError.textContent = '';
        dateError.style.display = 'none';
    }
}

if (dataOraInput && bookingForm && dateError) {
    dataOraInput.min = formatLocalDateTimeForInput(getEarliestAllowedDateTime());
    dataOraInput.addEventListener('input', updateBookingDateFeedback);
    dataOraInput.addEventListener('change', updateBookingDateFeedback);

    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        updateBookingDateFeedback();

        if (!bookingForm.checkValidity()) {
            dataOraInput.reportValidity();
            return;
        }

        const datiPrenotazione = {
            nome: document.getElementById('nome').value,
            cognome: document.getElementById('cognome').value,
            telefono: document.getElementById('telefono').value,
            dataOra: dataOraInput.value,
            persone: document.getElementById('persone').value
        };

        submitBtn.innerText = 'Generazione prenotazione...';
        submitBtn.disabled = true;

        try {
            const response = await fetch(BOOKING_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(datiPrenotazione)
            });

            if (!response.ok) {
                const message = await readErrorMessage(response);
                throw new Error(message);
            }

            const pdfBlob = await response.blob();
            const url = window.URL.createObjectURL(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Prenotazione_${datiPrenotazione.nome}_${datiPrenotazione.cognome}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            alert(error.message || 'Si è verificato un errore durante la prenotazione.');
        } finally {
            submitBtn.innerText = 'Invia Prenotazione';
            submitBtn.disabled = false;
        }
    });
}
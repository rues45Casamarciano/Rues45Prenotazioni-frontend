
const MINIMUM_ADVANCE_MINUTES = 60;
const FIRST_VALID_BOOKING_HOUR = 20;
const FIRST_VALID_BOOKING_MINUTE = 30;
const BOOKING_API_URL = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/prenota';

function parseLocalDateTime(value) {
    if (!value) return null;

    const [datePart, timePart] = value.split('T');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function validateBookingDateTime(value) {
    const selectedDateTime = parseLocalDateTime(value);
    if (!selectedDateTime) {
        return 'Seleziona una data e un orario validi.';
    }

    const now = new Date();
    const minimumAllowed = new Date(now.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);

    if (selectedDateTime < now) {
        return 'La data e l\'orario selezionati sono nel passato.';
    }

    if (selectedDateTime < minimumAllowed) {
        return `È necessario un anticipo minimo di ${MINIMUM_ADVANCE_MINUTES} minuti.`;
    }

    const isBeforeFirstValidSlot =
        selectedDateTime.getHours() < FIRST_VALID_BOOKING_HOUR ||
        (selectedDateTime.getHours() === FIRST_VALID_BOOKING_HOUR &&
            selectedDateTime.getMinutes() < FIRST_VALID_BOOKING_MINUTE);

    if (isBeforeFirstValidSlot) {
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

document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const dataOraInput = document.getElementById('dataOra');

    const datiPrenotazione = {
        nome: document.getElementById('nome').value,
        cognome: document.getElementById('cognome').value,
        telefono: document.getElementById('telefono').value,
        dataOra: dataOraInput.value,
        persone: document.getElementById('persone').value
    };

    const validationMessage = validateBookingDateTime(datiPrenotazione.dataOra);
    if (validationMessage) {
        dataOraInput.setCustomValidity(validationMessage);
        dataOraInput.reportValidity();
        return;
    }

    dataOraInput.setCustomValidity('');

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
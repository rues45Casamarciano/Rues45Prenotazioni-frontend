/**
 * @file Booking form client-side orchestration and validation logic.
 * @version 1.0.0
 */

const MINIMUM_ADVANCE_MINUTES = 60;
const FIRST_VALID_BOOKING_HOUR = 20;
const FIRST_VALID_BOOKING_MINUTE = 30;
const BOOKING_API_URL = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/prenota';

// =========================================================================
// DATE/TIME UTILITIES
// =========================================================================

/**
 * Parses an HTML5 datetime-local string input into a standard Date object.
 * @param {string} value - The datetime-local string (YYYY-MM-DDTHH:mm).
 * @returns {Date|null} The parsed Date object, or null if invalid.
 */
function parseLocalDateTime(value) {
    if (!value) return null;

    const [datePart, timePart] = value.split('T');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);

    return new Date(year, month - 1, day, hour, minute, 0, 0);
}

/**
 * Formats a Date object into a standard HTML5 datetime-local compatible string.
 * @param {Date} date - The date instance to transform.
 * @returns {string} Formatted string syntax: YYYY-MM-DDTHH:mm.
 */
function formatLocalDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// =========================================================================
// DYNAMIC CALENDAR MANAGEMENT
// =========================================================================

/**
 * Initializes and dynamically mutates the 'min' constraint attribute of the datetime input element.
 * @returns {void}
 */
function impostaDataMinimaPrenotazione() {
    const dataOraInput = document.getElementById('dataOra');
    if (!dataOraInput) return;

    const now = new Date();
    const minAdvanceThreshold = new Date(now.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);
    const venueOpeningToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        FIRST_VALID_BOOKING_HOUR,
        FIRST_VALID_BOOKING_MINUTE,
        0,
        0
    );

    const initialMinThreshold = minAdvanceThreshold > venueOpeningToday ? minAdvanceThreshold : venueOpeningToday;
    const initialMinFormated = formatLocalDateTime(initialMinThreshold);

    dataOraInput.min = initialMinFormated;

    const handleMinAttributeMutation = () => {
        const value = dataOraInput.value;
        if (!value) return;

        const selectedDate = parseLocalDateTime(value);
        if (!selectedDate) return;

        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfSelectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime();

        if (startOfSelectedDay > startOfToday) {
            const nextDayOpening = new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth(),
                selectedDate.getDate(),
                FIRST_VALID_BOOKING_HOUR,
                FIRST_VALID_BOOKING_MINUTE,
                0,
                0
            );
            dataOraInput.min = formatLocalDateTime(nextDayOpening);
        } else {
            dataOraInput.min = initialMinFormated;
        }
    };

    dataOraInput.addEventListener('change', handleMinAttributeMutation);
    dataOraInput.addEventListener('input', handleMinAttributeMutation);
}

// =========================================================================
// VALIDATION ENGINE
// =========================================================================

/**
 * Validates the selected booking timestamp constraint parameters.
 * @param {string} value - The current datetime input value.
 * @returns {string} Validation context error string, empty if execution clears thresholds.
 */
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

    const currentHours = selectedDateTime.getHours();
    const currentMinutes = selectedDateTime.getMinutes();

    const isBeforeFirstValidSlot =
        currentHours < FIRST_VALID_BOOKING_HOUR ||
        (currentHours === FIRST_VALID_BOOKING_HOUR && currentMinutes < FIRST_VALID_BOOKING_MINUTE);

    if (isBeforeFirstValidSlot) {
        return `La prima prenotazione valida è disponibile dalle ${String(FIRST_VALID_BOOKING_HOUR).padStart(2, '0')}:${String(FIRST_VALID_BOOKING_MINUTE).padStart(2, '0')}.`;
    }

    return '';
}

// =========================================================================
// NETWORK EXCEPTION HANDLING
// =========================================================================

/**
 * Safely parses fallback text or JSON error messaging configurations from standard Response objects.
 * @param {Response} response - The global Fetch API network response reference.
 * @returns {Promise<string>} Solved string context error description payload.
 */
async function readErrorMessage(response) {
    const contentType = response.headers.get('content-type') || '';
    const genericFallbackMsg = 'Errore durante la prenotazione.';

    if (contentType.includes('application/json')) {
        try {
            const data = await response.json();
            return data.message || data.error || genericFallbackMsg;
        } catch (jsonErr) {
            return genericFallbackMsg;
        }
    }
    
    try {
        const text = await response.text();
        return text || genericFallbackMsg;
    } catch (textErr) {
        return genericFallbackMsg;
    }
}

// =========================================================================
// EVENT LISTENERS & LIFECYCLE INITIALIZATION
// =========================================================================

document.addEventListener('DOMContentLoaded', impostaDataMinimaPrenotazione);

const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        const dataOraInput = document.getElementById('dataOra');
        if (!submitBtn || !dataOraInput) return;

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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datiPrenotazione)
            });

            if (!response.ok) {
                const message = await readErrorMessage(response);
                throw new Error(message);
            }

            const pdfBlob = await response.blob();
            const url = window.URL.createObjectURL(pdfBlob);
            const downloadAnchor = document.createElement('a');
            
            downloadAnchor.href = url;
            downloadAnchor.download = `Prenotazione_${datiPrenotazione.nome}_${datiPrenotazione.cognome}.pdf`;
            document.body.appendChild(downloadAnchor);
            
            downloadAnchor.click();
            downloadAnchor.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Booking submission sequence failed:', error.message);
            alert(error.message || 'Si è verificato un errore durante la prenotazione.');
        } finally {
            submitBtn.innerText = 'Invia Prenotazione';
            submitBtn.disabled = false;
        }
    });
}
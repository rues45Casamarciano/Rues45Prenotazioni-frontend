/**
 * @file Booking form client-side orchestration and validation logic.
 * @version 1.1.2
 */

const MINIMUM_ADVANCE_MINUTES = 60;
const FIRST_VALID_BOOKING_HOUR = 20;
const FIRST_VALID_BOOKING_MINUTE = 30;
const BOOKING_API_URL = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/prenota';
const API_VERIFICA_GIORNO = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/verifica-giorno';

// =========================================================================
// DATE/TIME UTILITIES
// =========================================================================

/**
 * Formats a Date object into a standard HTML5 date compatible string.
 * @param {Date} date - The date instance to transform.
 * @returns {string} Formatted string syntax: YYYY-MM-DD.
 */
function formatDateYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// =========================================================================
// DYNAMIC CALENDAR MANAGEMENT & ASYNC SEATS CAPACITY
// =========================================================================

/**
 * Initializes and handles live capacity checking when the date or guest number mutates.
 * @returns {void}
 */
function inizializzaGestioneCapienzaDinamica() {
    // Allineamento perfetto con gli ID del tuo HTML
    const dataGiornoInput = document.getElementById('dataGiorno');
    const dataOraSelect = document.getElementById('dataOraSelect');
    const personeInput = document.getElementById('persone');

    if (!dataGiornoInput || !dataOraSelect || !personeInput) {
        console.error("Errore: Uno o più elementi del form non sono stati trovati nel DOM.");
        return;
    }

    // Imposta il vincolo 'min' sul giorno corrente per impedire date passate
    const oraAttuale = new Date();
    dataGiornoInput.min = formatDateYYYYMMDD(oraAttuale);

    const aggiornaSlotOrariDisponibili = async () => {
        const giornoSelezionato = dataGiornoInput.value;
        const numeroPersone = parseInt(personeInput.value, 10) || 2;

        // Se l'utente rimuove o non seleziona un giorno, resettiamo lo stato della select
        if (!giornoSelezionato) {
            dataOraSelect.disabled = true;
            dataOraSelect.innerHTML = '<option value="">Scegli prima un giorno...</option>';
            return;
        }

        dataOraSelect.disabled = true;
        dataOraSelect.innerHTML = '<option value="">Aggiornamento disponibilità...</option>';

        try {
            const response = await fetch(API_VERIFICA_GIORNO, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dataGiorno: giornoSelezionato, persone: numeroPersone })
            });

            if (!response.ok) throw new Error('Errore risposta server');

            const mappaSlot = await response.json();
            dataOraSelect.innerHTML = '<option value="">-- Seleziona un orario --</option>';

            const adesso = new Date();
            const stringaOggiYMD = formatDateYYYYMMDD(adesso);

            for (const [ora, info] of Object.entries(mappaSlot)) {
                const opzione = document.createElement('option');
                opzione.value = ora;

                let disabilitatoPerTempo = false;

                // Se la data è oggi, applichiamo il vincolo dei 60 minuti minimi di anticipo
                if (giornoSelezionato === stringaOggiYMD) {
                    const [oreSlot, minutiSlot] = ora.split(':').map(Number);
                    const dataOggettoSlot = new Date(
                        adesso.getFullYear(),
                        adesso.getMonth(),
                        adesso.getDate(),
                        oreSlot,
                        minutiSlot,
                        0,
                        0
                    );
                    
                    const sogliaMinimaAnticipo = new Date(adesso.getTime() + (MINIMUM_ADVANCE_MINUTES * 60 * 1000));
                    
                    if (dataOggettoSlot < sogliaMinimaAnticipo) {
                        disabilitatoPerTempo = true;
                    }
                }

                // Applichiamo i blocchi logici e descrittivi basati sui dati ricevuti
                if (disabilitatoPerTempo) {
                    opzione.text = `${ora} (Non più prenotabile)`;
                    opzione.disabled = true;
                } else if (!info.disponibilePerGruppo) {
                    opzione.text = `${ora} (Esaurito - Rimasti ${info.postiRimasti} posti)`;
                    opzione.disabled = true;
                } else {
                    opzione.text = `${ora} (${info.postiRimasti} posti rimasti)`;
                }

                dataOraSelect.appendChild(opzione);
            }

            dataOraSelect.disabled = false;

        } catch (err) {
            console.error('Errore durante il recupero dei posti:', err);
            dataOraSelect.innerHTML = '<option value="">Errore nel caricamento orari. Riprova.</option>';
        }
    };

    dataGiornoInput.addEventListener('change', aggiornaSlotOrariDisponibili);
    personeInput.addEventListener('change', aggiornaSlotOrariDisponibili);
}

// =========================================================================
// VALIDATION ENGINE
// =========================================================================

/**
 * Validates the parameters of the selected date and time inputs.
 * @param {string} giorno - The chosen day (YYYY-MM-DD)
 * @param {string} ora - The chosen time slot (HH:mm)
 * @returns {string} Validation context error string, empty if execution clears thresholds.
 */
function validateBookingFields(giorno, ora) {
    if (!giorno || !ora) {
        return 'Seleziona una data e un orario validi.';
    }

    const [year, month, day] = giorno.split('-').map(Number);
    const [hour, minute] = ora.split(':').map(Number);
    const selectedDateTime = new Date(year, month - 1, day, hour, minute, 0, 0);

    const now = new Date();
    const minimumAllowed = new Date(now.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);

    if (selectedDateTime < now) {
        return 'La data e l\'orario selezionati sono nel passato.';
    }

    if (selectedDateTime < minimumAllowed) {
        return `È necessario un anticipo minimo di ${MINIMUM_ADVANCE_MINUTES} minuti.`;
    }

    const isBeforeFirstValidSlot =
        hour < FIRST_VALID_BOOKING_HOUR ||
        (hour === FIRST_VALID_BOOKING_HOUR && minute < FIRST_VALID_BOOKING_MINUTE);

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

document.addEventListener('DOMContentLoaded', inizializzaGestioneCapienzaDinamica);

const bookingForm = document.getElementById('bookingForm');
if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = document.getElementById('submitBtn');
        const dataGiornoInput = document.getElementById('dataGiorno');
        const dataOraSelect = document.getElementById('dataOraSelect');
        
        if (!submitBtn || !dataGiornoInput || !dataOraSelect) return;

        const giorno = dataGiornoInput.value;
        const ora = dataOraSelect.value;

        const datiPrenotazione = {
            nome: document.getElementById('nome').value,
            cognome: document.getElementById('cognome').value,
            telefono: document.getElementById('telefono').value,
            dataOra: `${giorno}T${ora}:00`,
            persone: document.getElementById('persone').value
        };

        const validationMessage = validateBookingFields(giorno, ora);
        if (validationMessage) {
            dataOraSelect.setCustomValidity(validationMessage);
            dataOraSelect.reportValidity();
            return;
        }

        dataOraSelect.setCustomValidity('');
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
const MINIMUM_ADVANCE_MINUTES = 60;
const FIRST_VALID_BOOKING_HOUR = 20;
const FIRST_VALID_BOOKING_MINUTE = 30;
const BOOKING_API_URL = 'https://rues45prenotazioni-backend-v6vi.onrender.com/api/prenota';

// =========================================================================
// 1. INIZIALIZZAZIONE E GESTIONE DINAMICA DEL CALENDARIO (ATTRIBUTO MIN)
// =========================================================================
function impostaDataMinimaPrenotazione() {
    const dataOraInput = document.getElementById('dataOra');
    if (!dataOraInput) return;

    const adesso = new Date();
    
    // Calcoliamo il limite di 60 minuti di anticipo
    const dataMinimaPreavviso = new Date(adesso.getTime() + MINIMUM_ADVANCE_MINUTES * 60 * 1000);
    
    // Orario di apertura di oggi (20:30)
    const aperturaOggi = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate(), FIRST_VALID_BOOKING_HOUR, FIRST_VALID_BOOKING_MINUTE, 0, 0);
    
    // Se l'orario attuale + 60 min ha già superato le 20:30, usiamo quello, altrimenti la base di partenza per oggi sono le 20:30
    let dataFinaleSoglia = dataMinimaPreavviso > aperturaOggi ? dataMinimaPreavviso : aperturaOggi;

    // Formattiamo per l'input HTML (fuso orario italiano garantito)
    const opzioni = { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    const formattatore = new Intl.DateTimeFormat('it-IT', opzioni);
    const parti = formattatore.formatToParts(dataFinaleSoglia);

    const map = {};
    parti.forEach(p => map[p.type] = p.value);

    // Questa è la stringa che rende tutto il passato GRIGIO e non cliccabile
    const formatoDatetimeLocal = `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
    
    dataOraInput.min = formatoDatetimeLocal;

    // GESTIONE DINAMICA: se l'utente cambia giorno, aggiorniamo il limite orario per non bloccare le date future
    dataOraInput.addEventListener('change', (e) => {
        const valoreSelezionato = e.target.value;
        if (!valoreSelezionato) return;

        const dataSelezionata = parseLocalDateTime(valoreSelezionato);
        const oggiSenzaOrario = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate(), 0, 0, 0, 0);
        const giornoSelezionatoSenzaOrario = new Date(dataSelezionata.getFullYear(), dataSelezionata.getMonth(), dataSelezionata.getDate(), 0, 0, 0, 0);

        // Se l'utente si sposta su un giorno successivo, l'orario minimo deve basarsi sulle 20:30 di quel giorno specifico
        if (giornoSelezionatoSenzaOrario > oggiSenzaOrario) {
            const anno = dataSelezionata.getFullYear();
            const mese = String(dataSelezionata.getMonth() + 1).padStart(2, '0');
            const giorno = String(dataSelezionata.getDate()).padStart(2, '0');
            const oraMin = String(FIRST_VALID_BOOKING_HOUR).padStart(2, '0');
            const minMin = String(FIRST_VALID_BOOKING_MINUTE).padStart(2, '0');
            
            e.target.min = `${anno}-${mese}-${giorno}T${oraMin}:${minMin}`;
        } else {
            // Se torna a oggi, riapplichiamo la restrizione iniziale restrittiva
            e.target.min = formatoDatetimeLocal;
        }
    });
}

// =========================================================================
// 2. PARSING E VALIDAZIONE LOGICA (AL SUBMIT)
// =========================================================================
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

// =========================================================================
// 3. LETTURA ERRORI DAL SERVER
// =========================================================================
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

// =========================================================================
// 4. INIZIALIZZAZIONE EVENTI
// =========================================================================

// Esegue il blocco grigio del calendario appena la pagina è caricata
document.addEventListener('DOMContentLoaded', impostaDataMinimaPrenotazione);

// Rimuove l'errore non appena l'utente corregge il campo
document.getElementById('dataOra').addEventListener('input', (e) => {
    e.target.setCustomValidity('');
});

// Gestore invio form
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    const dataOraInput = document.getElementById('dataOra');

    // Resettiamo l'errore per consentire invii successivi senza blocchi a monte del browser
    dataOraInput.setCustomValidity('');

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
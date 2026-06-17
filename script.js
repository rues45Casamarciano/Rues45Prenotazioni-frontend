document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    // 1. Impedisce alla pagina di ricaricarsi quando si preme il pulsante
    e.preventDefault();

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.innerText = "Generazione prenotazione...";
    submitBtn.disabled = true;

    // 2. Raccoglie i dati inseriti dall'utente nel Form
    const datiPrenotazione = {
        nome: document.getElementById('nome').value,
        cognome: document.getElementById('cognome').value,
        telefono: document.getElementById('telefono').value,
        dataOra: document.getElementById('dataOra').value,
        persone: document.getElementById('persone').value
    };

    try {
        // 3. Invia i dati al tuo server locale (in ascolto sulla porta 3000)
        const response = await fetch('https://rues45prenotazioni-backend.onrender.com/api/prenota', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datiPrenotazione)
        });

        if (!response.ok) {
            throw new Error("Errore durante la prenotazione");
        }

        // 4. Riceve il file PDF dal server e lo trasforma in un "Blob" (oggetto binario)
        const pdfBlob = await response.blob();
        
        // 5. Crea un link temporaneo nel browser per scaricare il PDF in automatico
        const url = window.URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Prenotazione_${datiPrenotazione.nome}_${datiPrenotazione.cognome}.pdf`;
        document.body.appendChild(a);
        a.click();
        
        // Pulisce la memoria del browser
        a.remove();
        window.URL.revokeObjectURL(url);

    } catch (error) {
        alert("Si è verificato un errore: " + error.message);
    } finally {
        // Ripristina il pulsante
        submitBtn.innerText = "Invia Prenotazione";
        submitBtn.disabled = false;
    }
});
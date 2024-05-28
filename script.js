const fileInput = document.getElementById('fileInput');
const searchInput = document.getElementById('searchInput');
const results = document.getElementById('results');
const dropzone = document.getElementById('dropzone');
const fileCount = document.getElementById('fileCount');
const searchButton = document.getElementById('searchButton');
let matchedFiles = [];
let allFiles = [];

function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Remove diacritics
}

async function searchWords() {
    const files = allFiles;
    const searchWords = searchInput.value.split(',').map(word => normalizeText(word.trim()));
    matchedFiles = [];

    results.innerHTML = ''; // Clear previous results
    searchButton.disabled = true; // Disable the search button

    if (files.length > 0 && searchWords.length > 0) {
        const filePromises = files.map(file => {
            return new Promise(resolve => {
                const reader = new FileReader();

                reader.onload = function() {
                    const typedArray = new Uint8Array(this.result);

                    pdfjsLib.getDocument(typedArray).promise.then(function(pdf) {
                        let totalPages = pdf.numPages;
                        let countPromises = [];

                        for (let i = 1; i <= totalPages; i++) {
                            countPromises.push(pdf.getPage(i).then(function(page) {
                                return page.getTextContent().then(function(textContent) {
                                    let text = textContent.items.map(item => item.str).join(" ");
                                    text = normalizeText(text);
                                    return searchWords.every(word => text.includes(word));
                                });
                            }));
                        }

                        Promise.all(countPromises).then(function(resultsArray) {
                            const found = resultsArray.every(found => found);
                            const resultItem = document.createElement('p');
                            resultItem.textContent = found ? `Las palabras "${searchInput.value}" se encuentran en "${file.name}".` : `Las palabras "${searchInput.value}" no se encuentran en "${file.name}".`;
                            resultItem.className = found ? 'found' : 'not-found';
                            results.appendChild(resultItem);

                            if (found) {
                                matchedFiles.push(file);
                            }
                            resolve();
                        });
                    });
                };

                reader.readAsArrayBuffer(file);
            });
        });

        Promise.all(filePromises).then(() => {
            searchButton.disabled = false; // Re-enable the search button
        });
    } else {
        results.textContent = 'Por favor, selecciona al menos un archivo PDF y escribe palabras para buscar.';
        searchButton.disabled = false; // Re-enable the search button
    }
}

function downloadZip() {
    if (matchedFiles.length === 0) {
        alert('No hay archivos que contengan las palabras buscadas.');
        return;
    }

    const zip = new JSZip();

    matchedFiles.forEach(file => {
        zip.file(file.name, file);
    });

    zip.generateAsync({ type: 'blob' }).then(content => {
        saveAs(content, 'documentos_contienen_palabras.zip');
    });
}

// Drag and Drop
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
    const items = event.dataTransfer.items;
    if (items.length > 0) {
        allFiles = await getAllFiles(items);
        dropzone.textContent = `${allFiles.length} archivos seleccionados.`;
        fileCount.textContent = `${allFiles.length} archivos seleccionados`;
    }
});

fileInput.addEventListener('change', () => {
    const files = fileInput.files;
    if (files.length > 0) {
        allFiles = Array.from(files);
        dropzone.textContent = `${files.length} archivos seleccionados.`;
        fileCount.textContent = `${files.length} archivos seleccionados`;
    }
});

async function getAllFiles(items) {
    const files = [];
    for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
            const result = await readEntry(entry);
            files.push(...result);
        }
    }
    return files.filter(file => file.type === 'application/pdf');
}

function readEntry(entry) {
    return new Promise((resolve) => {
        if (entry.isFile) {
            entry.file(file => resolve([file]));
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            dirReader.readEntries(async (entries) => {
                const results = await Promise.all(entries.map(entry => readEntry(entry)));
                resolve(results.flat());
            });
        }
    });
}

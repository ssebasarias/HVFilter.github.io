from flask import Flask, request, send_file, jsonify, render_template
import PyPDF2
import os
import tempfile
import zipfile
from fuzzywuzzy import fuzz
from unidecode import unidecode

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/filtrar', methods=['POST'])
def filtrar_archivos():
    palabras_buscadas = [unidecode(palabra.lower()) for palabra in request.form.getlist('frase')]
    archivos_pdf = request.files.getlist('carpeta')

    resultados = []
    archivos_filtrados = []

    # Crear una carpeta temporal
    with tempfile.TemporaryDirectory() as tmp_dir:
        for archivo in archivos_pdf:
            nombre_archivo = archivo.filename
            ruta_archivo = os.path.join(tmp_dir, 'carpeta', nombre_archivo)
            carpeta_archivo = os.path.dirname(ruta_archivo)

            # Verificar si la carpeta 'carpeta' existe, si no, crearla
            if not os.path.exists(carpeta_archivo):
                os.makedirs(carpeta_archivo)

            archivo.save(ruta_archivo)  # Guardar el archivo PDF en la carpeta temporal

            # Verifica si el archivo se guardó correctamente
            if not os.path.exists(ruta_archivo):
                resultados.append(f"Error: No se pudo guardar el archivo: {nombre_archivo}")
                continue

            # Leer el archivo PDF desde la carpeta temporal
            with open(ruta_archivo, 'rb') as f:
                pdf_reader = PyPDF2.PdfReader(f)
                num_pages = len(pdf_reader.pages)
                for page in range(num_pages):
                    page_obj = pdf_reader.pages[page]
                    text = unidecode(page_obj.extract_text().lower())  # Normalizar el texto extraído
                    for palabra_buscada in palabras_buscadas:
                        if palabra_buscada in text:
                            resultados.append(f"Los filtros se encuentra en el archivo: {nombre_archivo}")
                            archivos_filtrados.append(ruta_archivo)  # Agregar la ruta del archivo filtrado
                            break
                    else:
                        resultados.append(f"Los filtros NO se encuentra en el archivo: {nombre_archivo}")

        # Comprimir solo los archivos filtrados en un archivo zip
        with zipfile.ZipFile('archivos_filtrados.zip', 'w') as zipf:
            for archivo_filtrado in archivos_filtrados:
                zipf.write(archivo_filtrado, os.path.basename(archivo_filtrado))

        mensaje = f"Se realizó la búsqueda en los archivos PDF seleccionados."
        return render_template('resultados.html', mensaje=mensaje, resultados=resultados)

@app.route('/descargar/<path:filename>')
def descargar_archivo(filename):
    return send_file(filename, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)

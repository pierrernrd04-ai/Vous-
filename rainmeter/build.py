"""Fabrique MesWidgets.rmskin : un zip (chemins Windows) suivi du pied de 16 octets que l'installeur de Rainmeter attend."""
import io, os, struct, sys, zipfile

here = os.path.dirname(os.path.abspath(__file__))
src, plugin_dir = os.path.join(here, 'src'), sys.argv[1]  # dossier contenant x64/ et x32/WebView2.dll (plugin NSTechBytes, MIT)
buf = io.BytesIO()
with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk(src):
        for f in sorted(files):
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, src).replace('/', '\\'))
    z.write(os.path.join(plugin_dir, 'x64', 'WebView2.dll'), 'Plugins\\64bit\\WebView2.dll')
    z.write(os.path.join(plugin_dir, 'x32', 'WebView2.dll'), 'Plugins\\32bit\\WebView2.dll')
data = buf.getvalue()
with open(os.path.join(here, 'MesWidgets.rmskin'), 'wb') as out:
    out.write(data + struct.pack('<Q', len(data)) + b'\x00RMSKIN\x00')
print(len(data))

from PIL import Image

# Path to your PNG file
png_path = r"C:\Users\casey.keown\Documents\KSPTranscribe\app\static\favicon.png"

# Output ICO path
ico_path = r"C:\Users\casey.keown\Documents\KSPTranscribe\app\static\favicon.ico"

# Open the PNG image
img = Image.open(png_path)

# Convert to RGBA to preserve transparency
img = img.convert("RGBA")

# Save as favicon.ico with multiple sizes
img.save(
    ico_path,
    format="ICO",
    sizes=[(16, 16), (32, 32), (48, 48), (64, 64)]
)

print(f"Favicon created: {ico_path}")
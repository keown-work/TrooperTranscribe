from PIL import Image, ImageDraw
img = Image.new('RGBA', (32, 32), (12, 12, 14, 255))
d = ImageDraw.Draw(img)
pts = [(16,2),(30,8),(30,20),(16,30),(2,20),(2,8)]
d.polygon(pts, fill=(201,168,76,255))
d.polygon([(16,6),(26,11),(26,21),(16,27),(6,21),(6,11)], fill=(12,12,14,255))
d.polygon([(16,9),(23,13),(23,21),(16,25),(9,21),(9,13)], fill=(201,168,76,180))
img.save('app/static/favicon.ico', format='ICO', sizes=[(32,32),(16,16)])
print('favicon created')
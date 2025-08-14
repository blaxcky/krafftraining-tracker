#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

def create_fitness_icon(size):
    # Create image with alpha channel
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Background circle matching the maskable icon safe zone
    bg_color = (31, 41, 55, 255)  # Dark gray
    center = size // 2
    safe_zone_radius = int(size * 0.4)
    draw.ellipse([center - safe_zone_radius, center - safe_zone_radius, 
                  center + safe_zone_radius, center + safe_zone_radius], 
                 fill=bg_color)
    
    # Weight plate design
    outer_radius = int(size * 0.38) # Slightly smaller than safe zone
    inner_radius = size // 4
    hole_radius = size // 12
    
    # Outer weight plate ring
    plate_color = (55, 65, 81, 255)  # Lighter gray
    draw.ellipse([center - outer_radius, center - outer_radius,
                  center + outer_radius, center + outer_radius], 
                 fill=plate_color)
    
    # Inner circle
    draw.ellipse([center - inner_radius, center - inner_radius,
                  center + inner_radius, center + inner_radius], 
                 fill=bg_color)
    
    # Center hole
    draw.ellipse([center - hole_radius, center - hole_radius,
                  center + hole_radius, center + hole_radius], 
                 fill=plate_color)
    
    # Barbell bar
    bar_width = size // 20
    bar_length = size // 2
    bar_y = center - bar_width // 2
    draw.rounded_rectangle([center - bar_length//2, bar_y,
                           center + bar_length//2, bar_y + bar_width],
                          radius=bar_width//2, fill=(107, 114, 128, 255))
    
    # Add emoji-style muscle
    if size >= 192:
        try:
            font_size = size // 8
            # Use system font for emoji or text
            font = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", font_size)
            text = "💪"
            bbox = draw.textbbox((0, 0), text, font=font)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            text_x = center - text_width // 2
            text_y = center + size // 6
            draw.text((text_x, text_y), text, fill=(249, 250, 251, 255), font=font)
        except:
            # Fallback: draw simple dumbbell
            dumbbell_color = (249, 250, 251, 255)
            y_pos = center + size // 6
            draw.ellipse([center - 20, y_pos - 10, center + 20, y_pos + 10], fill=dumbbell_color)
    
    return img

# Create icons directory if it doesn't exist
os.makedirs('icons', exist_ok=True)

# Generate all required icon sizes
sizes = [72, 96, 128, 144, 152, 192, 384, 512]

for size in sizes:
    icon = create_fitness_icon(size)
    icon.save(f'icons/icon-{size}x{size}.png', 'PNG')
    print(f"Created icon-{size}x{size}.png")

print("All icons created successfully!")
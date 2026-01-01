# Fix LaTeX file - replace JavaScript language and Unicode characters
import re

with open(r'c:\Users\DELL\my-auth-api\complete_thesis.tex', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Replace JavaScript with Java (listings package compatible)
content = content.replace('language=JavaScript', 'language=Java')

# Fix 2: Remove emoji icon, replace with text
content = content.replace(r'\newcommand{\Strichmaxnnchen}{\textbf{👤}}', r'\newcommand{\Strichmaxnnchen}{\textbf{User}}')
content = content.replace('👤', 'User')

# Fix 3: Replace Unicode math symbols with LaTeX equivalents  
content = content.replace('≈', r'$\approx$')

# Fix 4: Escape LaTeX special characters
content = content.replace(' #', r' \#')  # Escape # character
content = content.replace('→', r'$\\rightarrow$')
content = content.replace('×', r'$\\times$')

# Write fixed file
with open(r'c:\Users\DELL\my-auth-api\complete_thesis_FIXED.tex', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ File fixed successfully!")
print("📁 New file: complete_thesis_FIXED.tex")
print("\n🔧 Changes made:")
print("  - Replaced 'language=JavaScript' → 'language=Java'")
print("  - Removed emoji 👤 → 'User'")  
print("  - Fixed Unicode math symbols (≈, →, ×)")

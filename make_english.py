
import re
import unicodedata

def make_english_only():
    input_path = r'c:\Users\DELL\my-auth-api\completed_thesis_EXPERT.tex'
    output_path = r'c:\Users\DELL\my-auth-api\final_thesis_report_ENGLISH.tex'
    
    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. REMOVE newunicodechar package and definitions causing errors
    content = re.sub(r'\\usepackage\{newunicodechar\}', '', content)
    content = re.sub(r'\\usepackage\{textcomp\}', '', content)
    
    # Remove the definition block we added previously
    content = re.sub(r'% Expert Unicode Definitions[\s\S]*?\\newunicodechar{→}{\$\\rightarrow\$}', '', content)
    content = re.sub(r'% Expert Unicode Definitions - Disabled[\s\S]*?% \\newunicodechar{→}{\$\\rightarrow\$}', '', content)

    # 2. MAP essential symbols to LaTeX, REMOVE icons
    replacements = {
        '↔': r'$\leftrightarrow$',
        '≤': r'$\le$',
        '≥': r'$\ge$',
        '≈': r'$\approx$',
        '×': r'$\times$',
        '→': r'$\rightarrow$',
        '–': '-', # En-dash
        '—': '-', # Em-dash
        '’': "'",
        '“': '"',
        '”': '"',
        '…': '...',
        'º': 'deg',
        '©': '(c)',
        # Icons to REMOVE completely (as requested)
        '✔': '', 
        '⚠️': '',
        '✅': '',
        '👤': 'User', # Keep this as User text, likely meaningful
        '₫': 'VND'
    }
    
    for char, replacement in replacements.items():
        content = content.replace(char, replacement)

    # 3. STRIP remaining non-ASCII (Vietnamese, etc.)
    # Normalize unicode to decompose accents
    nfkd_form = unicodedata.normalize('NFKD', content)
    # Filter out non-ASCII characters completely to ensure 100% English/ASCII
    ascii_content = "".join([c for c in nfkd_form if not unicodedata.combining(c) and ord(c) < 128])
    
    # 4. FIX listings config 
    # Remove the 'literate' block if it exists since we stripped the chars
    ascii_content = re.sub(r'literate=\{.*?\},', '', ascii_content, flags=re.DOTALL)
    
    # 5. Fix Javascript language again just in case
    ascii_content = ascii_content.replace('language=JavaScript', 'language=Java')

    # 6. Cleanup empty lines created by removals
    # Collapse 3+ newlines to 2
    ascii_content = re.sub(r'\n{3,}', '\n\n', ascii_content)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(ascii_content)
        
    print(f"✅ Created 100% English/ASCII file: {output_path}")

if __name__ == "__main__":
    make_english_only()

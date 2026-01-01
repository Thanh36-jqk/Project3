
import re
import os

def expert_fix_latex():
    input_path = r'c:\Users\DELL\my-auth-api\final_thesis_report.tex'
    output_path = r'c:\Users\DELL\my-auth-api\completed_thesis_EXPERT.tex'
    
    if not os.path.exists(input_path):
        print(f"File not found: {input_path}")
        return

    with open(input_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # ==========================
    # 1. PREAMBLE OPTIMIZATION
    # ==========================
    
    # Add microtype for better spacing (fixes overfull hbox)
    if r'{microtype}' not in content:
        content = content.replace(r'\usepackage{times}', r'\usepackage{times}' + '\n' + r'\usepackage{microtype}')
        
    # Add newunicodechar to safely handle unicode symbols that slip through
    if r'{newunicodechar}' not in content:
        content = content.replace(r'\usepackage[utf8]{inputenc}', r'\usepackage[utf8]{inputenc}' + '\n' + r'\usepackage{newunicodechar} ' + '\n' + r'\usepackage{textcomp}')

    # Fix headheight warning
    if r'\setlength{\headheight}' not in content:
        content = content.replace(r'\usepackage{fancyhdr}', r'\usepackage{fancyhdr}' + '\n' + r'\setlength{\headheight}{20pt} % Increased for safety')

    # Fix BibLaTeX backend (Biber is modern standard, BibTeX is fallback but can be buggy with IEEE)
    # However, if user uses Overleaf, Biber is default. Explicitly setting it helps.
    # User had warning: "Using fall-back bibtex backend".
    content = content.replace('backend=bibtex', 'backend=biber')

    # ==========================
    # 2. UNICODE & LISTINGS FIX
    # ==========================
    
    # Define replacements for newunicodechar right before \begin{document}
    unicode_defs = r'''
% Expert Unicode Definitions
\newunicodechar{↔}{$\leftrightarrow$}
\newunicodechar{≤}{$\le$}
\newunicodechar{≥}{$\ge$}
\newunicodechar{≈}{$\approx$}
\newunicodechar{✔}{\checkmark}
\newunicodechar{⚠️}{\textbf{!}}
\newunicodechar{×}{$\times$}
\newunicodechar{→}{$\rightarrow$}
'''
    if r'% Expert Unicode Definitions' not in content:
        content = content.replace(r'\begin{document}', unicode_defs + '\n' + r'\begin{document}')

    # Configure listings to handle Unicode via 'literate' mapping
    # This acts as a filter for code blocks
    literate_settings = r'''
    literate={↔}{{$\leftrightarrow$}}1 {≤}{{$\le$}}1 {≥}{{$\ge$}}1 {≈}{{$\approx$}}1 {✔}{{v}}1 {×}{{$\times$}}1 {→}{{$\rightarrow$}}1,
    extendedchars=true,
    inputencoding=utf8,
'''
    # Inject into \lstset
    if 'literate={' not in content:
        content = content.replace('breaklines=true,', 'breaklines=true,' + '\n' + literate_settings)

    # ==========================
    # 3. CONTENT SANITIZATION
    # ==========================
    
    # Ensure all listings use Java (JavaScript is not standard in basic listings)
    content = re.sub(r'language=JavaScript', 'language=Java', content, flags=re.IGNORECASE)
    content = re.sub(r'language=js', 'language=Java', content, flags=re.IGNORECASE)

    # Write final file
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(content)

    print(f"✅ Success! Created expert file: {output_path}")

if __name__ == "__main__":
    expert_fix_latex()

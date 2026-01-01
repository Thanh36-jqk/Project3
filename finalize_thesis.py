
import re

def finalize_thesis():
    input_file = r'c:\Users\DELL\my-auth-api\complete_thesis.tex'
    output_file = r'c:\Users\DELL\my-auth-api\final_thesis_report.tex'

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    # === PREAMBLE FIXES ===
    # Fix headheight warning
    if r'\setlength{\headheight}' not in content:
        content = content.replace(r'\usepackage{fancyhdr}', r'\usepackage{fancyhdr}' + '\n' + r'\setlength{\headheight}{15pt}')
    
    # === CONTENT PROCESSING ===
    # Split content into segments to handle code blocks differently
    segments = re.split(r'(\\begin\{lstlisting\}.*?\\end\{lstlisting\})', content, flags=re.DOTALL)
    processed_segments = []

    for segment in segments:
        if segment.startswith(r'\begin{lstlisting}'):
            # === CODE BLOCK SANITIZATION ===
            #listings package often chokes on non-ASCII. Enforce ASCII only.
            
            # 1. Normalize language
            segment = re.sub(r'language=JavaScript', 'language=Java', segment, flags=re.IGNORECASE)
            segment = re.sub(r'language=js', 'language=Java', segment, flags=re.IGNORECASE)
            
            # 2. Replace common smart characters with ASCII equivalents
            segment = segment.replace('“', '"').replace('”', '"')
            segment = segment.replace("‘", "'").replace("’", "'")
            segment = segment.replace("–", "-").replace("—", "-")
            
            # 3. Strip remaining non-ASCII characters
            # Encode to ascii, ignore errors, decode back. effectively removes unknown utf8
            cleaned_segment = segment.encode('ascii', 'ignore').decode('ascii')
            
            processed_segments.append(cleaned_segment)
        else:
            # === TEXT BLOCK SANITIZATION ===
            text = segment
            
            # 1. Escape # characters if they are not already escaped
            # Use negative lookbehind to ensure we don't double escape
            # But careful about URLs in \url{} or \href{}?
            # Usually better to escape globally in text mode. URLs in \url should handle # fine if hyperref is loaded,
            # but usually # in latex text MUST be escaped.
            # Simple strategy: Replace ALL ' #' with ' \#' (space hash) which is common usage
            # Or regex replace.
            
            # Regex: replace # that is NOT preceded by \
            text = re.sub(r'(?<!\\)#', r'\\#', text)
            
            # 2. Unicode Replacements for Text
            text = text.replace('≈', r'$\approx$')
            text = text.replace('→', r'$\rightarrow$')
            text = text.replace('×', r'$\times$')
            text = text.replace('≤', r'$\le$')
            text = text.replace('≥', r'$\ge$')
            text = text.replace('↔', r'$\leftrightarrow$') # Fix U+2194
            text = text.replace('₫', r'VND')
            text = text.replace('👤', 'User')
            text = text.replace('⚠️', r'\textbf{[Warning]}')
            text = text.replace('✅', r'\textbf{[Done]}')

            # 3. Aggressive ASCII fallback for Text blocks (to stop "Unicode character" errors)
            # This replaces any remaining non-ASCII chars with empty string or a placeholder, 
            # effectively stripping emojis/ weird symbols that weren't caught above.
            # We preserve common accented chars if possible, but for safety in this specific context,
            # stripping might be safer unless we use 'inputenx' or similar. 
            # Given the errors, safety first:
            
            # Use 'namereplace' to see what's being dropped if debugging, but 'ignore' is safer for compilation
            text = text.encode('ascii', 'ignore').decode('ascii')
            
            # 4. General cleanup
            processed_segments.append(text)

    final_content = "".join(processed_segments)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(final_content)

    print(f"Successfully created {output_file}")
    print("Fixes applied:")
    print("- Enforced ASCII in lstlisting blocks (Resolves 'Invalid UTF-8 byte sequence')")
    print("- Set headheight to 15pt (Resolves fancyhdr warning)")
    print("- Escaped unescaped # characters")
    print("- Replaced Unicode symbols")

if __name__ == "__main__":
    finalize_thesis()

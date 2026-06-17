import csv
import re

# Mapping of keywords in CSV categories to the IDs we created in SQL
CATEGORY_MAP = {
    # CAMA
    "BASE BOX": 2,
    "TRAVESSEIROS": 3,
    "CABECEIRAS": 4,
    "COLCHÕES ESTÁTICO": 5, # From CSV "COLCHÕES ESTÁTICO"
    "COLCHÕES TERAPÊUTICO": 6, # From CSV "COLCHÕES TERAPÊUTICO"
    
    # Sublevels of BASE BOX
    "CLASSE A": 7, # Note: this might overlap, but specifically for BASE BOX in CSV
    "HAIFLEX": 8, # CSV says HAIFLEX
    "INTENSE SIMPLES": 11,
    "INTENSE COM BAÚ": 10,
    "CLASSIC": 9,
    
    # TRAVESSEIROS
    "LATEX": 14,
    "POWERCHIP": 15,
    "CONFORT": 16,
    
    # CABECEIRAS
    "LINHA CLASSE A": 17,
    "LINHA INTENSE": 18,
    
    # COLCHÕES ESTÁTICOS
    "PRÓ-SAUDE": 19,
    "VITALITY": 20,
    "STYLE": 21,
    "PRIME": 22,
    "REALEZA": 23,
    
    # COLCHÕES TERAPÊUTICOS (IDs 24+)
    "TERAPÊUTICO": 6, 
}

# Advanced mapping for combined strings
def get_category_id(cat_str):
    if not cat_str or "Sem categoria" in cat_str:
        return "NULL"
    
    cat_str = cat_str.upper()
    
    # specific matches based on paths
    if "TERNOS > MICROFIBRA" in cat_str: return 46
    if "TERNOS > FIO INDIANO" in cat_str: return 47
    if "TERNOS > POLIVISCOSE" in cat_str: return 48
    if "BLAZERS > SARJA" in cat_str: return 51
    if "BLAZERS" in cat_str: return 49
    if "TERNOS" in cat_str: return 45
    
    if "CAMISA SOCIAL MANGA CURTA" in cat_str: return 43
    if "CAMISA SOCIAL MANGA LONGA" in cat_str: return 44
    if "CAMISA POLO" in cat_str: return 42
    if "CAMISETAS" in cat_str and "VESTUÁRIO MASCULINO" in cat_str: return 40
    if "BERMUDAS" in cat_str and "VESTUÁRIO MASCULINO" in cat_str: return 39
    if "CALÇAS" in cat_str and "VESTUÁRIO MASCULINO" in cat_str: return 41
    if "VESTUÁRIO MASCULINO" in cat_str: return 38
    
    if "SAPATÊNIS" in cat_str: return 53
    if "TÊNIS" in cat_str and "CALÇADO MASCULINO" in cat_str: return 54
    if "SAPATO SOCIAL" in cat_str and "CALÇADO MASCULINO" in cat_str: return 55
    if "CHINELOS" in cat_str and "CALÇADO MASCULINO" in cat_str: return 56
    if "CALÇADO MASCULINO" in cat_str: return 52

    if "SCARPIN" in cat_str: return 72
    if "SANDÁLIAS" in cat_str: return 71
    if "RASTEIRAS" in cat_str: return 69
    if "SAPATILHAS" in cat_str: return 70
    if "MULES" in cat_str: return 67
    if "MOCASSIM" in cat_str: return 66
    if "BOTAS" in cat_str: return 64
    if "TÊNIS CASUAL" in cat_str: return 74
    if "TÊNIS ESPORTIVO" in cat_str: return 75
    if "VESTUÁRIO FEMININO" in cat_str or "VESTUÁRIO FEMININOS" in cat_str:
        if "VESTIDOS" in cat_str: return 80
        if "LINGERIE" in cat_str: return 81
        if "SAIAS" in cat_str: return 79
        return 60
    if "FEMININO" in cat_str or "FEMENINO" in cat_str:
        if "BOLSAS" in cat_str: return 61
        return 57

    if "ACESSÓRIOS" in cat_str:
        if "CARTEIRAS" in cat_str: return 35
        if "CINTOS" in cat_str: return 36
        if "PULSEIRA" in cat_str: return 37
        return 34

    if "CONSÓRCIO" in cat_str: return 82
    if "PROMOÇÕES" in cat_str: return 83

    # BEDDING Logic
    if "BASE BOX" in cat_str:
        if "LUXO" in cat_str: return 13
        if "STANDARD" in cat_str or "ESTARDARD" in cat_str: return 12
        if "INTENSE COM BAÚ" in cat_str: return 10
        if "INTENSE SIMPLES" in cat_str: return 11
        if "CLASSIC" in cat_str: return 9
        if "HIFLEX" in cat_str: return 8
        if "CLASSE A" in cat_str: return 7
        return 2

    if "COLCHÕES TERAPÊUTICO" in cat_str or "COLCHÕES TERAPÊUTICOS" in cat_str:
        if "PRÓ-SAÚDE" in cat_str or "PRÓ-SAUDE" in cat_str: return 28
        if "VITALITY" in cat_str: return 29
        if "STYLE" in cat_str: return 30
        if "PRIME" in cat_str: return 31
        if "REALEZA" in cat_str: return 32
        if "INTENSE" in cat_str: return 27
        if "CLASSIC" in cat_str: return 26
        return 6

    if "COLCHÕES ESTÁTICO" in cat_str or "COLCHÕES ESTÁTICOS" in cat_str:
        if "PRÓ-SAÚDE" in cat_str or "PRÓ-SAUDE" in cat_str: return 19
        if "VITALITY" in cat_str: return 20
        if "STYLE" in cat_str: return 21
        if "PRIME" in cat_str: return 22
        if "REALEZA" in cat_str: return 23
        return 5

    if "TRAVESSEIROS" in cat_str:
        if "LATEX" in cat_str: return 14
        if "POWERCHIP" in cat_str: return 15
        if "CONFORT" in cat_str: return 16
        return 3

    if "CAMA" in cat_str: return 1

    return "NULL"

def clean_value(val, type='str'):
    if not val:
        if type == 'int' or type == 'float': return "0"
        return "NULL"
    
    val = val.strip()
    if type == 'float':
        # Handles "235" or "532,50"
        val = val.replace(',', '.')
        try:
            return str(float(val))
        except:
            return "0"
    if type == 'int':
        try:
            return str(int(float(val.replace(',', '.'))))
        except:
            return "0"
    
    # Escape single quotes for SQL
    return val.replace("'", "''")

input_file = r'C:\Users\eu\Downloads\todos os produtos classe A.csv'
output_file = r'C:\Users\eu\Documents\P4D\Projetos\Classe A\import_products.sql'

with open(input_file, mode='r', encoding='utf-8-sig') as csvfile:
    reader = csv.DictReader(csvfile)
    sql_entries = []
    
    # Header for the SQL
    sql_entries.append("-- IMPORT PRODUCTS SCRIPT")
    sql_entries.append("TRUNCATE TABLE public.products RESTART IDENTITY CASCADE;")
    sql_entries.append("")

    for row in reader:
        name = clean_value(row.get('Nome'))
        description = clean_value(row.get('Descrição curta'))
        stock = clean_value(row.get('Estoque'), 'int')
        weight = clean_value(row.get('Peso (kg)'), 'float')
        length = clean_value(row.get('Comprimento (cm)'), 'float')
        width = clean_value(row.get('Largura (cm)'), 'float')
        height = clean_value(row.get('Altura (cm)'), 'float')
        price = clean_value(row.get('Preço'), 'float')
        
        # Images: pick the first one if multiple
        images_str = row.get('Imagens', '')
        image_url = "NULL"
        if images_str:
            first_image = images_str.split(',')[0].strip()
            image_url = f"'{first_image}'"
        
        # Category ID
        cat_id = get_category_id(row.get('Categorias', ''))
        
        # Origin Zip (default from form state)
        origin_zip = "'82820-160'"
        
        sql = f"INSERT INTO public.products (id, name, description, stock_quantity, price, category_id, image_url, weight, length, width, height, origin_zip, is_active) VALUES (gen_random_uuid(), '{name}', '{description}', {stock}, {price}, {cat_id}, {image_url}, {weight}, {length}, {width}, {height}, {origin_zip}, true);"
        sql_entries.append(sql)

with open(output_file, mode='w', encoding='utf-8') as f:
    f.write("\n".join(sql_entries))

print(f"SQL script generated at: {output_file}")

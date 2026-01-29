/**
 * Common Industry Shorthand Dictionary for SKU generation
 */
const SKU_DICTIONARY = {
    'PHONE': 'PH',
    'PROTECTOR': 'PROT',
    'WARRANTY': 'WRNTY',
    'WANRATY': 'WRNTY',
    'BATTERY': 'BATT',
    'CHARGER': 'CHRG',
    'DISPLAY': 'DISP',
    'TEMPERED': 'TMPR',
    'ORIGINAL': 'ORG',
    'REPAIR': 'RPR',
    'SERVICE': 'SRVC',
    'GLASS': 'GLS',
    'BLACK': 'BLK', 'WHITE': 'WHT', 'SILVER': 'SLV', 'GOLD': 'GLD',
    'BLUE': 'BLU', 'RED': 'RED', 'GREEN': 'GRN', 'YELLOW': 'YLW',
    'ORANGE': 'ORG', 'PURPLE': 'PUR', 'PINK': 'PNK', 'GREY': 'GRY',
    'GRAY': 'GRY', 'SPACE GREY': 'SPG', 'MIDNIGHT': 'MID', 'STARLIGHT': 'STR',
    '64GB': '64G', '128GB': '128G', '256GB': '256G', '512GB': '512G', '1TB': '1TB'
};

/**
 * Processes text for SKU shorthand
 */
const processText = (text) => {
    if (!text) return '';

    return text
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .split(/[\s-]+/)
        .filter(word => word.length > 0)
        .map(word => {
            if (SKU_DICTIONARY[word]) return SKU_DICTIONARY[word];
            if (/^\d+[A-Z]*$/.test(word)) return word;
            if (word.length <= 3) return word;
            return word.substring(0, 4);
        })
        .join('-');
};

/**
 * Generates a universal SKU based on item and attributes
 */
const generateUniversalSku = (item, attributes = []) => {
    if (!item) return '';

    // For item objects or name strings
    const itemName = typeof item === 'string' ? item : item.itemName;
    const baseSku = typeof item === 'object' && item.sku ? item.sku.toUpperCase() : processText(itemName);

    const attrSuffix = attributes
        .map(a => processText(a.value))
        .filter(val => val !== '')
        .join('-');

    return attrSuffix ? `${baseSku}-${attrSuffix}` : baseSku;
};

module.exports = {
    processText,
    generateUniversalSku
};

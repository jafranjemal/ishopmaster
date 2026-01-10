const DEVICE_SPECS = {
    // Apple
    'iPhone 6': { ram: '1GB', storage: '16/64/128GB', display: '4.7"', rear: '8MP', batt: 1810, colors: ['Black', 'White', 'Gold'] },
    'iPhone 7': { ram: '2GB', storage: '32/128/256GB', display: '4.7"', rear: '12MP', batt: 1960, colors: ['Black', 'White', 'Gold'] },
    'iPhone X': { ram: '3GB', storage: '64/256GB', display: '5.8"', rear: '12MP Dual', batt: 2716, colors: ['Black', 'White', 'Gold'] },
    'iPhone 11': { ram: '4GB', storage: '128GB', display: '6.1"', rear: '12MP', batt: 3110, colors: ['Black', 'White', 'Purple', 'Green', 'Yellow', 'Red'] },
    'iPhone 12': { ram: '4GB', storage: '128GB', display: '6.1"', rear: '12MP', batt: 2815, colors: ['Black', 'White', 'Blue', 'Green', 'Purple', 'Red'] },
    'iPhone 13': { ram: '4GB', storage: '128GB', display: '6.1"', rear: '12MP', batt: 3227, colors: ['Midnight', 'Starlight', 'Blue', 'Pink', 'Green', 'Red'] },
    'iPhone 14': { ram: '6GB', storage: '128GB', display: '6.1"', rear: '12MP', batt: 3279, colors: ['Midnight', 'Starlight', 'Blue', 'Purple', 'Yellow', 'Red'] },
    'iPhone 15 Pro': { ram: '8GB', storage: '128GB', display: '6.1"', rear: '48MP', batt: 3274, colors: ['Black Titanium', 'White Titanium', 'Blue Titanium', 'Natural Titanium'] },
    'iPhone 16 Pro Max': { ram: '8GB', storage: '256GB', display: '6.9"', rear: '48MP', batt: 4685, colors: ['Desert Titanium', 'Natural Titanium', 'White Titanium', 'Black Titanium'] },
    'iPhone 17 Pro Max': { ram: '12GB', storage: '256/512GB/1TB/2TB', display: '6.9"', rear: '48MP Quad', batt: 4685, colors: ['Black', 'White', 'Gold'] },

    // Samsung
    'Galaxy S23 Ultra': { ram: '12GB', storage: '256GB', display: '6.8"', rear: '200MP', batt: 5000, colors: ['Phantom Black', 'Cream', 'Green', 'Lavender'] },
    'Galaxy S24 Ultra': { ram: '12GB', storage: '256GB', display: '6.8"', rear: '200MP', batt: 5000, colors: ['Titanium Gray', 'Titanium Black', 'Titanium Violet', 'Titanium Yellow'] },
    'Galaxy A54': { ram: '8GB', storage: '128GB', display: '6.4"', rear: '50MP', batt: 5000, colors: ['Awesome Graphite', 'Awesome White', 'Awesome Lime', 'Awesome Violet'] },

    // Xiaomi / Redmi
    'Redmi Note 12 Pro': { ram: '8GB', storage: '128GB', display: '6.67"', rear: '50MP', batt: 5000, colors: ['Stardust Purple', 'Frosted Blue', 'Onyx Black'] },
    'Redmi Note 13 Pro+': { ram: '12GB', storage: '256GB', display: '6.67"', rear: '200MP', batt: 5000, colors: ['Fusion Black', 'Fusion White', 'Fusion Purple'] },
    'Xiaomi 14': { ram: '12GB', storage: '256GB', display: '6.36"', rear: '50MP', batt: 4610, colors: ['Black', 'White', 'Jade Green'] }
};

const getModelsList = () => {
    return [
        ...Object.keys(DEVICE_SPECS).filter(n => n.startsWith('iPhone')).map(name => ({ brand: 'Apple', name })),
        ...Object.keys(DEVICE_SPECS).filter(n => n.startsWith('Galaxy')).map(name => ({ brand: 'Samsung', name })),
        ...Object.keys(DEVICE_SPECS).filter(n => n.startsWith('Redmi') || n.startsWith('Xiaomi')).map(name => ({ brand: 'Xiaomi', name }))
    ];
};

const getRegistryForSync = () => {
    const list = getModelsList();
    return list.map(item => ({
        brand: item.brand.toUpperCase(),
        model: item.name,
        colors: DEVICE_SPECS[item.name].colors || []
    }));
};

module.exports = {
    DEVICE_SPECS,
    getModelsList,
    getRegistryForSync
};

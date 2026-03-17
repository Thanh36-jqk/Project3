const productColorVariants = {
    // ========== IPHONE MODELS ==========
    'iPhone 11': [
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/iphone 11/11 white.png' },
        { name: 'Green', hex: '#aee1cd', image: 'assets/images/iphone 11/11green.png' },
        { name: 'Yellow', hex: '#ffe681', image: 'assets/images/iphone 11/iphone 11 yellow.png' },
        { name: 'Red', hex: '#ba0c2f', image: 'assets/images/iphone 11/iphone-11 red.png' }
    ],
    'iPhone 12': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iphone 12/iphone 12 black.png' },
        { name: 'Purple', hex: '#b9b5d7', image: 'assets/images/iphone 12/iphone 12 purple.png' },
        { name: 'Red', hex: '#ba0c2f', image: 'assets/images/iphone 12/iphone 12 red.png' }
    ],
    'iPhone 13': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iphone 13/iphone 13 black.png' },
        { name: 'Blue', hex: '#276787', image: 'assets/images/iphone 13/iphone 13 blue.png' },
        { name: 'Gold', hex: '#fad7bd', image: 'assets/images/iphone 13/iphone 13 gold.png' }
    ],
    'iPhone 14': [
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/iphone 14/iPhone_14 white.png' },
        { name: 'Red', hex: '#ba0c2f', image: 'assets/images/iphone 14/iphone 14 red.png' },
        { name: 'Purple', hex: '#e0d1e8', image: 'assets/images/iphone 14/iphone_14_purple.png' },
        { name: 'Yellow', hex: '#f9e179', image: 'assets/images/iphone 14/iphone_14_yellow.png' }
    ],
    'iPhone 14 Pro Max': [
        { name: 'Purple', hex: '#594f63', image: 'assets/images/iphone 14 pro max/14_pro_max_purple-removebg-preview.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/iphone 14 pro max/14_promax_gold-removebg-preview.png' },
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iphone 14 pro max/iphone 14 pro max black.png' },
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/iphone 14 pro max/iphone 14 pro max white.png' }
    ],
    'iPhone 15 Plus': [
        { name: 'Yellow', hex: '#f9e179', image: 'assets/images/iphone 15 plus/15_plus_yellow-removebg-preview.png' },
        { name: 'Green', hex: '#d5e8d4', image: 'assets/images/iphone 15 plus/iPhone_15_Plus-removebg-preview.png' },
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iphone 15 plus/iphone_15_plus_black-removebg-preview.png' },
        { name: 'Blue', hex: '#a8c5dd', image: 'assets/images/iphone 15 plus/iphone_15_plus_blue-removebg-preview.png' },
        { name: 'Rose', hex: '#f4c2c2', image: 'assets/images/iphone 15 plus/iphone_15_plus_rose-removebg-preview.png' }
    ],
    'iPhone 15 Pro Max': [
        { name: 'Silver', hex: '#e3e4e5', image: 'assets/images/iphone 15 pro max/15_pro_max_silver-removebg-preview.png' },
        { name: 'Blue', hex: '#2d5f7e', image: 'assets/images/iphone 15 pro max/iphone-15-pro-max-blue-removebg-preview.png' },
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/iphone 15 pro max/iphone_15_pro_max_white-removebg-preview.png' }
    ],
    'iPhone 16 Pro Max': [
        { name: 'Gold Rose', hex: '#e8c4b8', image: 'assets/images/iphone 16 pro max/iphone 16 promax gold rose rm.png' },
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/iphone 16 pro max/iphone 16 promax white remove.png' },
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iphone 16 pro max/test1.png' }
    ],
    'iPhone SE (3rd Gen)': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/iPhone SE (3rd Gen)/iphone se 3rd black.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/iPhone SE (3rd Gen)/iphone se 3rd gold.png' },
        { name: 'Red', hex: '#ba0c2f', image: 'assets/images/iPhone SE (3rd Gen)/iphone se 3rd red.png' }
    ],

    // ========== IPAD MODELS ==========
    'iPad (10th Gen)': [
        { name: 'Blue', hex: '#a8dadc', image: 'assets/images/ipad (10th gen)/ipad gen 10 blue.webp' },
        { name: 'Pink', hex: '#ffc0cb', image: 'assets/images/ipad (10th gen)/ipad gen 10 pink.png' },
        { name: 'Yellow', hex: '#f9e179', image: 'assets/images/ipad (10th gen)/ipad gen 10 yellow.webp' }
    ],
    'iPad Air M2': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/ipad air m2/ipad air m2 black.png' },
        { name: 'Blue', hex: '#4a90e2', image: 'assets/images/ipad air m2/ipad air m2 blue.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/ipad air m2/ipad air m2 gold.png' }
    ],
    'iPad mini 6': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/ipad mini 6/ipad mini 6 black.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/ipad mini 6/ipad mini 6 gold.png' },
        { name: 'Purple', hex: '#b9b5d7', image: 'assets/images/ipad mini 6/ipad mini 6 purple.png' }
    ],
    'iPad Pro': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/ipad pro/ipad pro black.png' },
        { name: 'Silver', hex: '#e3e4e5', image: 'assets/images/ipad pro/ipad pro silver.png' }
    ],
    'iPad Pro M4': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/ipad pro m4/ipad pro m4 black.png' },
        { name: 'Silver', hex: '#e3e4e5', image: 'assets/images/ipad pro m4/ipad pro m4 silver.png' }
    ],

    // ========== APPLE WATCH MODELS ==========
    'Apple Watch Series 9': [
        { name: 'Blue', hex: '#4a90e2', image: 'assets/images/Apple Watch Series 9/watch series 9 blue.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/Apple Watch Series 9/watch series 9 gold.png' },
        { name: 'Rose', hex: '#f4c2c2', image: 'assets/images/Apple Watch Series 9/watch series 9 rose.png' },
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Apple Watch Series 9/watch seris 9 black.png' }
    ],
    'Apple Watch SE': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Apple Watch SE/se black.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/Apple Watch SE/se gold.png' }
    ],
    'Apple Watch Ultra 2': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 black.webp' },
        { name: 'Blue', hex: '#4a90e2', image: 'assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 blue.png' },
        { name: 'Orange', hex: '#ff6b35', image: 'assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 orange.png' }
    ],

    // ========== AUDIO PRODUCTS ==========
    'AirPods Max': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Air pod max/airpod max black.png' },
        { name: 'Orange', hex: '#ff6b35', image: 'assets/images/Air pod max/airpod max orange.webp' },
        { name: 'White', hex: '#f5f5f7', image: 'assets/images/Air pod max/airpod max white.png' }
    ],

    // ========== MAC MODELS ==========
    'MacBook Air 15 M3': [
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/mac air 15/air 15 gold.png' },
        { name: 'Grey', hex: '#535456', image: 'assets/images/mac air 15/macbook air 15 grey.png' }
    ],

    // ========== IPHONE 7 & 8 PLUS (NEW) ==========
    'iPhone 7 Plus': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Iphone 7 Plus/Iphone 7 plus black.png' },
        { name: 'Gold', hex: '#fad7a0', image: 'assets/images/Iphone 7 Plus/Iphone 7 plus gold.png' },
        { name: 'Silver', hex: '#e3e4e5', image: 'assets/images/Iphone 7 Plus/Iphone 7 plus silver.png' }
    ],
    'iPhone 8 Plus': [
        { name: 'Black', hex: '#1d1d1f', image: 'assets/images/Iphone 8 Plus/iphone 8 plus black.png' },
        { name: 'Grey', hex: '#8e8e93', image: 'assets/images/Iphone 8 Plus/iphone 8 plus grey.png' },
        { name: 'Red', hex: '#ba0c2f', image: 'assets/images/Iphone 8 Plus/iphone 8 plus red.png' }
    ]
};

window.productColorVariants = productColorVariants;

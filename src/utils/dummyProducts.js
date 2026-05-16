// src/utils/dummyProducts.js

const dummyProducts = [
    // --- IPHONE ---
    { _id: 'ip1', name: 'iPhone 16 Pro Max', category: 'iPhone', price: 34990000, image_url: 'assets/images/iphone 16 pro max/iphone 16 promax white remove.png', desc: 'A18 Pro chip. Built for Apple Intelligence.' },
    { _id: 'ip2', name: 'iPhone 15 Pro Max', category: 'iPhone', price: 29990000, image_url: 'assets/images/iphone 15 pro max/15_pro_max_silver-removebg-preview.png', desc: 'Titanium design. A17 Pro chip.' },
    { _id: 'ip3', name: 'iPhone 15 Plus', category: 'iPhone', price: 23990000, image_url: 'assets/images/iphone 15 plus/iphone_15_plus_blue-removebg-preview.png', desc: 'Big screen. Big battery life.' },
    { _id: 'ip4', name: 'iPhone 15', category: 'iPhone', price: 19990000, image_url: 'assets/images/iphone 15 plus/15_plus_yellow-removebg-preview.png', desc: 'Dynamic Island. 48MP Main camera.' },
    { _id: 'ip5', name: 'iPhone 14 Pro Max', category: 'iPhone', price: 26500000, image_url: 'assets/images/iphone 14 pro max/iphone 14 pro max black.png', desc: 'Pro camera system. A16 Bionic.' },
    { _id: 'ip6', name: 'iPhone 14', category: 'iPhone', price: 17490000, image_url: 'assets/images/iphone 14/iPhone_14 white.png', desc: 'Full of fantastic features.' },
    { _id: 'ip7', name: 'iPhone 13', category: 'iPhone', price: 13990000, image_url: 'assets/images/iphone 13/iphone 13 blue.png', desc: 'Total powerhouse. A15 Bionic.' },
    { _id: 'ip8', name: 'iPhone SE (3rd Gen)', category: 'iPhone', price: 10990000, image_url: 'assets/images/iPhone SE (3rd Gen)/iphone se 3rd black.png', desc: 'Serious power. Mini price.' },
    { _id: 'ip9', name: 'iPhone 12', category: 'iPhone', price: 11990000, image_url: 'assets/images/iphone 12/iphone 12 black.png', desc: 'A14 Bionic. OLED display.' },
    { _id: 'ip10', name: 'iPhone 11', category: 'iPhone', price: 8990000, image_url: 'assets/images/iphone 11/11 white.png', desc: 'Just the right amount of everything.' },
    { _id: 'ip11', name: 'iPhone 8 Plus', category: 'iPhone', price: 9990000, image_url: 'assets/images/Iphone 8 Plus/iphone 8 plus black.png', desc: 'Glass design. Wireless charging. A11 Bionic.' },
    { _id: 'ip12', name: 'iPhone 7 Plus', category: 'iPhone', price: 7990000, image_url: 'assets/images/Iphone 7 Plus/Iphone 7 plus black.png', desc: 'Dual camera. Water resistant. A10 Fusion.' },

    // --- MAC ---
    { _id: 'mac1', name: 'MacBook Air 15 M3', category: 'Mac', price: 32990000, image_url: 'assets/images/mac air 15/macbook air 15 grey.png', desc: 'Lean. Mean. M3 machine.' },
    { _id: 'mac2', name: 'MacBook Pro 14 M3', category: 'Mac', price: 39990000, image_url: 'assets/images/mac air 15/macbook air 15 grey.png', desc: 'Mind-blowing. Head-turning.' },
    { _id: 'mac3', name: 'iMac 24 M3', category: 'Mac', price: 36990000, image_url: 'assets/images/iMac 24 M3/iMac 24 M3.png', desc: 'Packed with more juice.' },
    { _id: 'mac4', name: 'Mac mini M2', category: 'Mac', price: 14990000, image_url: 'assets/images/Mac mini M2/MAC mini m2.png', desc: 'More muscle. More hustle.' },

    // --- IPAD ---
    { _id: 'pad1', name: 'iPad Pro M4', category: 'iPad', price: 28990000, image_url: 'assets/images/ipad pro m4/ipad pro m4 black.png', desc: 'Thinpossible. The ultimate iPad experience.' },
    { _id: 'pad2', name: 'iPad Air M2', category: 'iPad', price: 16990000, image_url: 'assets/images/ipad air m2/ipad air m2 gold.png', desc: 'Fresh air. Serious performance.' },
    { _id: 'pad3', name: 'iPad (10th Gen)', category: 'iPad', price: 9990000, image_url: 'assets/images/ipad (10th gen)/ipad gen 10 pink.png', desc: 'Lovable. Drawable. Magical.' },
    { _id: 'pad4', name: 'iPad mini 6', category: 'iPad', price: 12990000, image_url: 'assets/images/ipad mini 6/ipad mini 6 purple.png', desc: 'Mega power. Mini size.' },

    // --- WATCH ---
    { _id: 'w1', name: 'Apple Watch Ultra 2', category: 'Watch', price: 21990000, image_url: 'assets/images/Apple Watch Ultra 2/Apple Watch Ultra 2 blue.png', desc: 'Next-level adventure.' },
    { _id: 'w2', name: 'Apple Watch Series 9', category: 'Watch', price: 10490000, image_url: 'assets/images/Apple Watch Series 9/watch series 9 rose.png', desc: 'Smarter. Brighter. Mightier.' },
    { _id: 'w3', name: 'Apple Watch SE', category: 'Watch', price: 6290000, image_url: 'assets/images/Apple Watch SE/se black.png', desc: 'A great deal to love.' },

    // --- AUDIO & HOME ---
    { _id: 'au1', name: 'AirPods Pro 2', category: 'HeadPhone', price: 6190000, image_url: 'assets/images/AirPods Pro 2/air pod pro.png', desc: 'Adaptive Audio. Now playing.' },
    { _id: 'au2', name: 'AirPods Max', category: 'HeadPhone', price: 13990000, image_url: 'assets/images/Air pod max/airpod max white.png', desc: 'High-fidelity audio. Effortless magic.' },
    { _id: 'au3', name: 'AirPods 3', category: 'HeadPhone', price: 4490000, image_url: 'assets/images/AirPods 3/airpod 3.png', desc: 'All-new design. Spatial Audio.' },
    { _id: 'au4', name: 'HomePod', category: 'HeadPhone', price: 7990000, image_url: 'assets/images/HomePod/homepod.png', desc: 'Profound sound.' },
    { _id: 'au5', name: 'Apple TV 4K', category: 'HeadPhone', price: 3490000, image_url: 'assets/images/Apple TV 4K/Apple TV 4k.png', desc: 'The Apple experience. Cinematic.' }
];

module.exports = dummyProducts;

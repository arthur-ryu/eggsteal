const express = require('express');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Render 환경 변수(MONGO_URI)를 우선 사용하고, 없으면 로컬 DB를 바라보게 안전하게 설정
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'egg_game_db';
let db;

const SHOP_ITEMS = {
    '기본 점핑패드': { price: 0, mult: 1 },
    '골드 점프패드': { price: 150000, mult: 1.5 },
    '다이아 점프패드': { price: 2000000, mult: 2.5 },
    '무지개 점프패드': { price: 50000000, mult: 4 },
    '다크 점프패드': { price: 1000000000, mult: 7 },
    '공허 점프패드': { price: 35000000000, mult: 15 },
    '천상 점프패드': { price: 1000000000000, mult: 30 }
};

const STAGES = [
    { eggName: '바다알' }, { eggName: '산알' }, { eggName: '용암알' },
    { eggName: '하늘알' }, { eggName: '벚꽃알' }, { eggName: '우주알' },
    { eggName: '천사알' }, { eggName: '악마알' }
];

const PET_POOLS = {
    '바다알': ['🐢', '🐚', '🦪', '🦐', '🦞', '🦀', '🦑', '🐙', '🪼', '🐡', '🐟', '🐠', '🦭', '🦦', '🐬', '🐋', '🐳', '🦈'],
    '산알': ['🐸', '🐍', '🦎', '🐰', '🦔', '🐿️', '🦫', '🦡', '🐐', '🐏', '🐑', '🦙', '🐗', '🫎', '🦌', '🐺', '🦊', '🐻', '🐅'],
    '용암알': ['🐅', '🐆', '🦬', '🦏', '🐘', '🦣', '🐊', '🦂', '🦇', '🦕', '🐲', '🐉', '🦖'],
    '하늘알': ['🪲', '🐞', '🪰', '🐝', '🦋', '🦤', '🐓', '🦃', '🦚', '🦜', '🐦', '🐤', '🐥', '🐣', '🕊️', '🦢', '🦩', '🦅', '🦉', '🪽'],
    '벚꽃알': ['🐮', '🐷', '🐽', '🐔', '🐕', '🐈', '🦨', '🦥', '🦝', '🐭', '🐹', '🐴', '🦄', '🐶', '🐱', '🐅🌸'],
    '우주알': ['🐪', '🐫', '🦘', '🦓', '🦒', '🦛', '🦁', '🐯', '🐼', '🐨', '🦍', '🦧', '🐵', '🙈', '🙉', '🙊', '👽'],
    '악마알': ['🔱', '🔥', '💀', '☠️', '👹', '👺', '🩸', '🕷️', '🕸️', '🦂', '🦇', '🐍', '🐉', '🐲', '👁️', '🌑', '🖤', '⛓️', '😈', '👿'],
    '천사알': ['😇', '✨', '🌟', '⭐', '💫', '☀️', '🌈', '🤍', '🕊️', '🦢', '🦄', '🌷', '💎', '☁️', '🌙', '👼']
};

const BASE_MPS = { 
    '바다알': 10, '산알': 50, '용암알': 400, '하늘알': 3000, 
    '벚꽃알': 25000, '우주알': 250000, '천사알': 2500000, '악마알': 25000000 
};

const onlineUsers = new Map();

async function startServer() {
    try {
        const client = new MongoClient(mongoURI);
        await client.connect();
        db = client.db(dbName);
        console.log('MongoDB 연결 성공!');
        
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => console.log(`서버 실행 중... 포트: ${PORT}`));
    } catch (err) { console.error('MongoDB 연결 에러:', err); }
}
startServer();

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.json({ success: false, message: '이름과 비밀번호를 입력해주세요.' });

    const existingUser = await db.collection('users').findOne({ username });
    if (existingUser) return res.json({ success: false, message: '이미 존재하는 계정입니다.' });

    const newUser = {
        username, password, clickPower: 1, money: 10000, 
        inventory: ['기본 점핑패드'], equipped: '기본 점핑패드', pets: [], equippedPets: [],
        isFirstLogin: true 
    };
    await db.collection('users').insertOne(newUser);
    res.json({ success: true, message: '회원가입 완료! 10,000원이 지급되었습니다. 로그인해주세요.' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.collection('users').findOne({ username, password });
    if (user) {
        res.cookie('auth_user', username, { maxAge: 1000 * 60 * 60 * 24, httpOnly: true });
        onlineUsers.set(username, Date.now()); 
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '이름 또는 비밀번호가 틀렸습니다.' });
    }
});

app.post('/api/logout', (req, res) => { 
    const username = req.cookies.auth_user;
    if(username) onlineUsers.delete(username); 
    res.clearCookie('auth_user'); 
    res.json({ success: true }); 
});

app.get('/api/userdata', async (req, res) => {
    const username = req.cookies.auth_user;
    if (!username) return res.json({ success: false });
    const user = await db.collection('users').findOne({ username });
    if (user) {
        onlineUsers.set(username, Date.now()); 
        if (!user.clickPower) user.clickPower = 1;
        if (!user.pets) user.pets = [];
        if (!user.equippedPets) user.equippedPets = [];
        res.json({ success: true, user });
    } else res.json({ success: false });
});

app.post('/api/finish_intro', async (req, res) => {
    const username = req.cookies.auth_user;
    if(username) await db.collection('users').updateOne({ username }, { $set: { isFirstLogin: false } });
    res.json({ success: true });
});

app.post('/api/tick', async (req, res) => {
    const username = req.cookies.auth_user;
    const { isAutoUpgrading } = req.body;
    if (!username) return res.json({ success: false });

    onlineUsers.set(username, Date.now());

    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false });

    let totalMps = 0;
    if (user.equippedPets && user.equippedPets.length > 0) {
        user.equippedPets.forEach(id => {
            let pet = user.pets.find(p => p.id === id);
            if (pet) totalMps += pet.mps;
        });
    }

    let newMoney = user.money + totalMps;
    let newPower = user.clickPower || 1;
    if (isAutoUpgrading) newPower += 10; 

    await db.collection('users').updateOne({ username }, { $set: { money: newMoney, clickPower: newPower } });
    res.json({ success: true, money: newMoney, clickPower: newPower, mps: totalMps });
});

app.get('/api/online', (req, res) => {
    const now = Date.now();
    const activeUsers = [];
    for (const [user, lastSeen] of onlineUsers.entries()) {
        if (now - lastSeen < 10000) activeUsers.push(user);
        else onlineUsers.delete(user); 
    }
    res.json({ success: true, users: activeUsers });
});

app.post('/api/hatch', async (req, res) => {
    const username = req.cookies.auth_user;
    const { eggName } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const eggIndex = user.inventory.indexOf(eggName);
    if (eggIndex === -1) return res.json({ success: false, message: '알이 존재하지 않습니다.' });

    user.inventory.splice(eggIndex, 1);

    const pool = PET_POOLS[eggName];
    if (!pool) return res.json({ success: false, message: '잘못된 알입니다.' });

    let weights = [];
    let totalWeight = 0;
    for(let i = 0; i < pool.length; i++) {
        let w = Math.pow(0.55, i); 
        weights.push(w);
        totalWeight += w;
    }
    let r = Math.random() * totalWeight;
    let randomIndex = 0;
    for(let i = 0; i < pool.length; i++) {
        if(r < weights[i]) { randomIndex = i; break; }
        r -= weights[i];
    }

    const pickedEmoji = pool[randomIndex];
    const baseMps = BASE_MPS[eggName];
    const mps = Math.floor(baseMps * Math.pow(1.45, randomIndex));
    
    const newPet = { id: Date.now() + Math.floor(Math.random()*1000), emoji: pickedEmoji, eggSource: eggName, mps: mps };
    user.pets.push(newPet);

    await db.collection('users').updateOne({ username }, { $set: { inventory: user.inventory, pets: user.pets } });
    res.json({ success: true, newPet, inventory: user.inventory, pets: user.pets });
});

app.post('/api/buy', async (req, res) => {
    const username = req.cookies.auth_user;
    const { itemName } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false });

    const itemData = SHOP_ITEMS[itemName];
    if (!itemData) return res.json({ success: false });
    if (user.inventory.includes(itemName)) return res.json({ success: false, message: '이미 보유 중인 아이템입니다.' });

    if (user.money >= itemData.price) {
        user.money -= itemData.price;
        user.inventory.push(itemName);
        await db.collection('users').updateOne({ username }, { $set: { money: user.money, inventory: user.inventory } });
        res.json({ success: true, money: user.money, inventory: user.inventory });
    } else {
        res.json({ success: false, message: '자금이 부족합니다.' });
    }
});

// 콘솔 조작 방지 검증 추가
app.post('/api/escape', async (req, res) => {
    const username = req.cookies.auth_user;
    const { stageIndex } = req.body;
    
    if (stageIndex === undefined || stageIndex < 0 || stageIndex >= STAGES.length) {
        return res.json({ success: false, message: '비정상적인 접근입니다.' });
    }

    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false });

    const stage = STAGES[stageIndex];
    user.inventory.push(stage.eggName);

    await db.collection('users').updateOne({ username }, { $set: { inventory: user.inventory } });
    res.json({ success: true, eggName: stage.eggName, inventory: user.inventory });
});

// 펫 ID 위변조 방지 검증 추가
app.post('/api/equip', async (req, res) => {
    const username = req.cookies.auth_user;
    const { equipped, equippedPets } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false });

    if (equipped && !user.inventory.includes(equipped)) {
        return res.json({ success: false, message: '보유하지 않은 장비입니다.' });
    }

    let validEquippedPets = [];
    if (Array.isArray(equippedPets)) {
        for (let petId of equippedPets) {
            let foundPet = user.pets.find(p => p.id === petId);
            if (foundPet && !validEquippedPets.includes(petId)) {
                validEquippedPets.push(petId);
            }
        }
        if (validEquippedPets.length > 7) {
            validEquippedPets = validEquippedPets.slice(0, 7);
        }
    }

    await db.collection('users').updateOne({ username }, { $set: { equipped, equippedPets: validEquippedPets } });
    res.json({ success: true, equippedPets: validEquippedPets });
});

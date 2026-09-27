const express = require('express');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'egg_game_db';
let db;

const SHOP_ITEMS = {
    '기본 점핑패드': { price: 0, mult: 1 },
    '골드 점프패드': { price: 500000, mult: 1.5 },
    '다이아 점프패드': { price: 10000000, mult: 2.5 },
    '무지개 점프패드': { price: 300000000, mult: 4 },
    '다크 점프패드': { price: 8000000000, mult: 7 },
    '공허 점프패드': { price: 200000000000, mult: 15 },
    '천상 점프패드': { price: 10000000000000, mult: 30 }
};

const STAGES = [
    { name: 'Lv.1 바다', escapeClicks: 500, eggName: '바다알' }, 
    { name: 'Lv.2 산', escapeClicks: 5000, eggName: '산알' },
    { name: 'Lv.3 화산', escapeClicks: 40000, eggName: '용암알' },
    { name: 'Lv.4 하늘', escapeClicks: 400000, eggName: '하늘알' },
    { name: 'Lv.5 벚꽃', escapeClicks: 4000000, eggName: '벚꽃알' },
    { name: 'Lv.6 우주', escapeClicks: 50000000, eggName: '우주알' },
    { name: 'Lv.7 천사', escapeClicks: 150000000, eggName: '천사알' },
    { name: 'Lv.8 악마', escapeClicks: 800000000, eggName: '악마알' }
];

const PET_POOLS = {
    '바다알': ['🐢', '🐚', '🦪', '🦐', '🦞', '🦀', '🦑', '🐙', '🪼', '🐡', '🐟', '🐠', '🦭', '🦦', '🐬', '🐋', '🐳', '🦈'],
    '산알': ['🐸', '🐍', '🦎', '🐰', '🦔', '🐿️', '🦫', '🦡', '🐐', '🐏', '🐑', '🦙', '🐗', '🫎', '🦌', '🐺', '🦊', '🐻', '🐅'],
    '용암알': ['🐅', '🐆', '🦬', '🦏', '🐘', '🦣', '🐊', '🦂', '🦇', '🦕', '🐲', '🐉', '🦖'],
    '하늘알': ['🪲', '🐞', '🪰', '🐝', '🦋', '🦤', '🐓', '🦃', '🦚', '🦜', '🐦', '🐤', '🐥', '🐣', '🕊️', '🦢', '🦩', '🦅', '🦉', '🪽'],
    '벚꽃알': ['🐮', '🐷', '🐽', '🐔', '🐕', '🐈', '🦨', '🦥', '🦝', '🐭', '🐹', '🐴', '🦄', '🐶', '🐱', '🐅🌸'],
    '우주알': ['🐪', '🐫', '🦘', '🦓', '🦒', '🦛', '🦁', '🐯', '🐼', '🐨', '🦍', '🦧', '🐵', '🙈', '🙉', '🙊', '👽'],
    '악마알': ['🔱', '🔥', '💀', '☠️', '👹', '👺', '🩸', '🕷️', '🕸️', '🦂', '🦇', '🐍', '🐉', '🐲', '👁️', '🌑', '🖤', '⛓️', '👿', '😈'],
    '천사알': ['😇', '✨', '🌟', '⭐', '💫', '☀️', '🌈', '🤍', '🕊️', '🦢', '🦄', '🌷', '💎', '☁️', '🌙', '👼']
};

const BASE_MPS = { 
    '바다알': 8, 
    '산알': 40, 
    '용암알': 320, 
    '하늘알': 2400, 
    '벚꽃알': 20000, 
    '우주알': 200000, 
    '천사알': 2000000, 
    '악마알': 20000000 
};

const DEX_REWARDS = {
    '일반': { power: 2, money: 1000 },
    '레어': { power: 5, money: 5000 },
    '에픽': { power: 15, money: 25000 },
    '전설': { power: 50, money: 150000 },
    '신화': { power: 200, money: 1500000 },
    '코스믹': { power: 1000, money: 15000000 },
    '비밀': { power: 5000, money: 150000000 },
    '디바인': { power: 25000, money: 1500000000 }
};

function getPetRarity(eggName, index, totalLength) {
    if ((eggName === '천사알' || eggName === '악마알') && index === totalLength - 1) return '디바인';

    let minRarityIdx = 0;
    if (eggName === '용암알') minRarityIdx = 1;
    if (eggName === '하늘알') minRarityIdx = 2;
    if (eggName === '벚꽃알') minRarityIdx = 2;
    if (eggName === '우주알') minRarityIdx = 2;
    if (eggName === '천사알' || eggName === '악마알') minRarityIdx = 3;

    const rarities = ['일반', '레어', '에픽', '전설', '신화', '코스믹', '비밀'];
    const available = rarities.slice(minRarityIdx);
    const ratio = index / Math.max(1, totalLength - 1);
    const chosenIdx = Math.min(available.length - 1, Math.floor(ratio * available.length));
    return available[chosenIdx];
}

// 💡 5개 슬롯 상태 관리: isGone(누가 훔치면 사라짐)
const stagesState = STAGES.map(() => ({
    slots: Array.from({ length: 5 }, () => ({ busyBy: null, distanceProgress: 0, isGone: false }))
}));

const userLocations = new Map();
const onlineUsers = new Map();

let isNight = false;
let cycleTimer = 300; // 낮 300초(5분)
let nightCount = 0;
let nextCosmicTarget = 7 + Math.floor(Math.random() * 4); // 7~10회차
let nextSecretTarget = 18 + Math.floor(Math.random() * 5); // 18~22회차

let globalSpecialEgg = null;
let globalNotice = "";

setInterval(() => {
    cycleTimer--;

    // 💡 밤이 되고 5초 뒤 (남은 시간 5초 시점): 모든 알 리셋 및 5개 훔치기 버튼 부활
    if (isNight && cycleTimer === 5) {
        stagesState.forEach(st => {
            st.slots = Array.from({ length: 5 }, () => ({ busyBy: null, distanceProgress: 0, isGone: false }));
        });
        globalNotice = "⚡ 모든 알이 리셋되었습니다! 다음 낮에 새로운 알들이 기다립니다.";
    }

    if (cycleTimer <= 0) {
        if (!isNight) {
            // 낮 종료 -> 밤 시작 (10초)
            isNight = true;
            cycleTimer = 10;
            nightCount++;
            globalNotice = "🌙 밤이 찾아왔습니다! 잠시 후 알들이 리셋됩니다.";

            // 플레이어 슬롯 점유 강제 해제
            stagesState.forEach(st => {
                st.slots.forEach(slot => { slot.busyBy = null; });
            });
        } else {
            // 밤 종료 -> 낮 시작 (300초)
            isNight = false;
            cycleTimer = 300;
            globalNotice = "";

            // 💡 낮이 될 때 스페셜 알 스폰 체크 및 전체 공지
            if (nightCount >= nextCosmicTarget) {
                const sIdx = Math.floor(Math.random() * STAGES.length);
                const slotIdx = Math.floor(Math.random() * 5);
                globalSpecialEgg = { type: 'cosmic', stageIndex: sIdx, slotIndex: slotIdx, eggName: '코스믹알' };
                globalNotice = `🌌 [전체 공지] ${STAGES[sIdx].name}에 코스믹 알이 스폰되었습니다!`;
                nextCosmicTarget = nightCount + 7 + Math.floor(Math.random() * 4);
            } else if (nightCount >= nextSecretTarget) {
                const sIdx = Math.floor(Math.random() * STAGES.length);
                const slotIdx = Math.floor(Math.random() * 5);
                globalSpecialEgg = { type: 'secret', stageIndex: sIdx, slotIndex: slotIdx, eggName: '시크릿알' };
                globalNotice = `🌑 [전체 공지] ${STAGES[sIdx].name}에 전설의 시크릿 알이 스폰되었습니다!`;
                nextSecretTarget = nightCount + 18 + Math.floor(Math.random() * 5);
            }
        }
    }
}, 1000);

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
        inventory: ['기본 점핑패드'], equipped: '기본 점핑패드', pets: [], equippedPets: [], claimedDex: [],
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
    if(username) {
        onlineUsers.delete(username);
        userLocations.delete(username);
    }
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
        if (!user.claimedDex) user.claimedDex = [];
        res.json({ success: true, user });
    } else res.json({ success: false });
});

app.post('/api/finish_intro', async (req, res) => {
    const username = req.cookies.auth_user;
    if(username) await db.collection('users').updateOne({ username }, { $set: { isFirstLogin: false } });
    res.json({ success: true });
});

app.post('/api/sync_stage', (req, res) => {
    const username = req.cookies.auth_user;
    const { stageIndex } = req.body;
    if (!username) return res.json({ success: false });

    onlineUsers.set(username, Date.now());
    if (stageIndex !== undefined && stageIndex !== null && stageIndex >= 0) {
        userLocations.set(username, { stageIndex, lastSeen: Date.now() });
    } else {
        userLocations.delete(username);
    }

    const usersInStage = [];
    const now = Date.now();
    for (const [u, info] of userLocations.entries()) {
        if (now - info.lastSeen < 6000 && info.stageIndex === stageIndex) {
            usersInStage.push(u);
        }
    }

    const currentStageState = (stageIndex >= 0 && stageIndex < stagesState.length) ? stagesState[stageIndex] : null;

    res.json({
        success: true,
        isNight,
        cycleTimer,
        globalNotice,
        globalSpecialEgg,
        usersInStage,
        slots: currentStageState ? currentStageState.slots : []
    });
});

// 💡 알 훔치기 시작: 누르면 즉시 isGone = true로 설정되어 모든 유저 화면에서 사라짐
app.post('/api/start_steal', (req, res) => {
    const username = req.cookies.auth_user;
    const { stageIndex, slotIndex } = req.body;
    if (!username) return res.json({ success: false, message: '로그인이 필요합니다.' });
    if (isNight) return res.json({ success: false, message: '밤에는 알을 훔칠 수 없습니다!' });

    if (stageIndex < 0 || stageIndex >= stagesState.length || slotIndex < 0 || slotIndex >= 5) {
        return res.json({ success: false, message: '잘못된 슬롯입니다.' });
    }

    const slot = stagesState[stageIndex].slots[slotIndex];
    if (slot.isGone || (slot.busyBy && slot.busyBy !== username)) {
        return res.json({ success: false, message: '이미 다른 유저가 훔쳐간 알입니다!' });
    }

    slot.busyBy = username;
    slot.isGone = true; // 💡 사라짐 확정

    const totalEscape = STAGES[stageIndex].escapeClicks;
    const savedDistance = slot.distanceProgress || 0;
    const remainingClicks = Math.max(50, totalEscape - savedDistance);

    res.json({
        success: true,
        savedDistance,
        targetEscapeClicks: remainingClicks
    });
});

// 훔치다 잡혔을 때: 점유 해제 및 진행 거리 기록 (단, 알은 리셋 전까지 사라진 상태 유지)
app.post('/api/fail_steal', (req, res) => {
    const username = req.cookies.auth_user;
    const { stageIndex, slotIndex, progressMade } = req.body;
    if (!username) return res.json({ success: false });

    if (stageIndex >= 0 && stageIndex < stagesState.length && slotIndex >= 0 && slotIndex < 5) {
        const slot = stagesState[stageIndex].slots[slotIndex];
        if (slot.busyBy === username) {
            slot.busyBy = null;
            slot.distanceProgress = Math.min(STAGES[stageIndex].escapeClicks * 0.9, (slot.distanceProgress || 0) + (progressMade || 0));
        }
    }
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

    let pickedEmoji = '❓';
    let rarity = '일반';
    let baseMps = 10;

    if (eggName === '코스믹알') {
        const cosmicEmojis = ['🌌', '🪐', '🌠', '☄️', '🛸', '🛰️', '👽'];
        pickedEmoji = cosmicEmojis[Math.floor(Math.random() * cosmicEmojis.length)];
        rarity = '코스믹';
        baseMps = 3500000;
    } else if (eggName === '시크릿알') {
        const secretEmojis = ['👁️', '🌑', '🖤', '⛓️', '🎭', '🔮', '🗝️'];
        pickedEmoji = secretEmojis[Math.floor(Math.random() * secretEmojis.length)];
        rarity = '비밀';
        baseMps = 35000000;
    } else {
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

        pickedEmoji = pool[randomIndex];
        baseMps = Math.floor(BASE_MPS[eggName] * Math.pow(1.45, randomIndex));
        rarity = getPetRarity(eggName, randomIndex, pool.length);
    }
    
    const rawWeight = 1.0 + Math.pow(Math.random(), 4) * 9999.0;
    const weight = Math.round(rawWeight * 10) / 10;
    const weightBonus = 1 + (weight * 0.002);
    const mps = Math.floor(baseMps * weightBonus);
    
    const newPet = { 
        id: Date.now() + Math.floor(Math.random()*1000), 
        emoji: pickedEmoji, 
        eggSource: eggName, 
        mps: mps,
        weight: weight,
        rarity: rarity
    };
    user.pets.push(newPet);

    await db.collection('users').updateOne({ username }, { $set: { inventory: user.inventory, pets: user.pets } });
    res.json({ success: true, newPet, inventory: user.inventory, pets: user.pets });
});

app.post('/api/claim_dex', async (req, res) => {
    const username = req.cookies.auth_user;
    const { eggName, emoji } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const key = `${eggName}_${emoji}`;
    const claimedDex = user.claimedDex || [];
    if (claimedDex.includes(key)) return res.json({ success: false, message: '이미 보상을 수령한 동물입니다.' });

    const hasPet = user.pets && user.pets.some(p => p.eggSource === eggName && p.emoji === emoji);
    if (!hasPet) return res.json({ success: false, message: '아직 획득하지 못한 동물입니다.' });

    const pool = PET_POOLS[eggName] || [];
    const idx = pool.indexOf(emoji);
    const rarity = getPetRarity(eggName, idx, pool.length);
    const reward = DEX_REWARDS[rarity] || { power: 2, money: 1000 };

    claimedDex.push(key);
    const newPower = (user.clickPower || 1) + reward.power;
    const newMoney = (user.money || 0) + reward.money;

    await db.collection('users').updateOne({ username }, {
        $set: { claimedDex: claimedDex, clickPower: newPower, money: newMoney }
    });

    res.json({
        success: true,
        rewardPower: reward.power,
        rewardMoney: reward.money,
        clickPower: newPower,
        money: newMoney,
        claimedDex: claimedDex
    });
});

app.post('/api/sell_pet', async (req, res) => {
    const username = req.cookies.auth_user;
    const { petId } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const petIndex = user.pets.findIndex(p => p.id === petId);
    if (petIndex === -1) return res.json({ success: false, message: '보유하지 않은 동물입니다.' });

    const targetPet = user.pets[petIndex];
    const sellPrice = Math.floor(targetPet.mps * 0.5);

    user.pets.splice(petIndex, 1);
    user.money += sellPrice;

    let newEquippedPets = (user.equippedPets || []).filter(id => id !== petId);

    await db.collection('users').updateOne({ username }, { 
        $set: { pets: user.pets, money: user.money, equippedPets: newEquippedPets } 
    });

    res.json({ 
        success: true, 
        money: user.money, 
        pets: user.pets, 
        equippedPets: newEquippedPets, 
        soldPrice: sellPrice 
    });
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

app.post('/api/escape', async (req, res) => {
    const username = req.cookies.auth_user;
    const { stageIndex, slotIndex, isSpecial, specialType } = req.body;
    
    if (stageIndex === undefined || stageIndex < 0 || stageIndex >= STAGES.length) {
        return res.json({ success: false, message: '비정상적인 접근입니다.' });
    }

    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    let eggToGive = STAGES[stageIndex].eggName;
    if (isSpecial) {
        if (specialType === 'cosmic') eggToGive = '코스믹알';
        else if (specialType === 'secret') eggToGive = '시크릿알';
        globalSpecialEgg = null;
    }

    user.inventory.push(eggToGive);
    await db.collection('users').updateOne({ username }, { $set: { inventory: user.inventory } });
    res.json({ success: true, eggName: eggToGive, inventory: user.inventory });
});

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

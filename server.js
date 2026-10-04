const express = require('express');
const { MongoClient } = require('mongodb');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'egg_game_db';
let db;

const sessions = new Map();

function authenticateUser(req) {
    const token = req.cookies.auth_session;
    if (!token || !sessions.has(token)) return null;
    return sessions.get(token);
}

// 💡 신규 '코블 점프패드' (50조 / x40) 추가
const SHOP_ITEMS = {
    '기본 점핑패드': { price: 0, mult: 1 },
    '골드 점프패드': { price: 500000, mult: 1.5 },
    '다이아 점프패드': { price: 10000000, mult: 2.5 },
    '무지개 점프패드': { price: 300000000, mult: 4 },
    '다크 점프패드': { price: 8000000000, mult: 7 },
    '공허 점프패드': { price: 200000000000, mult: 15 },
    '천상 점프패드': { price: 10000000000000, mult: 30 },
    '코블 점프패드': { price: 50000000000000, mult: 40 }
};

const STAGES = [
    { name: 'Lv.1 바다', escapeClicks: 500, eggName: '바다알' }, 
    { name: 'Lv.2 산', escapeClicks: 5000, eggName: '산알' },
    { name: 'Lv.3 화산', escapeClicks: 40000, eggName: '용암알' },
    { name: 'Lv.4 하늘', escapeClicks: 400000, eggName: '하늘알' },
    { name: 'Lv.5 벚꽃', escapeClicks: 4000000, eggName: '벚꽃알' },
    { name: 'Lv.6 우주', escapeClicks: 50000000, eggName: '우주알' },
    { name: 'Lv.7 천사', escapeClicks: 150000000, eggName: '천사알' },
    { name: 'Lv.8 악마', escapeClicks: 800000000, eggName: '악마알' },
    { name: 'Lv.9 마법의 숲', escapeClicks: 50000000000, eggName: '마법숲알' }
];

const PET_POOLS = {
    '바다알': ['🐢', '🐚', '🦪', '🦐', '🦞', '🦀', '🦑', '🐙', '🪼', '🐡', '🐟', '🐠', '🦭', '🦦', '🐬', '🐋', '🐳', '🦈'],
    '산알': ['🐸', '🐍', '🦎', '🐰', '🦔', '🐿️', '🦫', '🦡', '🐐', '🐏', '🐑', '🦙', '🐗', '🫎', '🦌', '🐺', '🦊', '🐻', '🐅'],
    '용암알': ['🐅', '🐆', '🦬', '🦏', '🐘', '🦣', '🐊', '🦂', '🦇', '🦕', '🐲', '🐉', '🦖'],
    '하늘알': ['🪲', '🐞', '🪰', '🐝', '🦋', '🦤', '🐓', '🦃', '🦚', '🦜', '🐦', '🐤', '🐥', '🐣', '🕊', '🦢', '🦩', '🦅', '🦉', '🪽'],
    '벚꽃알': ['🐮', '🐷', '🐽', '🐔', '🐕', '🐈', '🦨', '🦥', '🦝', '🐭', '🐹', '🐴', '🦄', '🐶', '🐱', '🐅🌸'],
    '우주알': ['🐪', '🐫', '🦘', '🦓', '🦒', '🦛', '🦁', '🐯', '🐼', '🐨', '🦍', '🦧', '🐵', '🙈', '🙉', '🙊', '👽'],
    '악마알': ['🔱', '🔥', '💀', '☠️', '👹', '👺', '🩸', '🕷️', '🕸', '🦂', '🦇', '🐍', '🐉', '🐲', '👁️', '🌑', '🖤', '⛓️', '👿', '😈'],
    '천사알': ['😇', '✨', '🌟', '⭐', '💫', '☀️', '🌈', '🤍', '🕊️', '🦢', '🦄', '🌷', '💎', '☁', '🌙', '👼'],
    '마법숲알': [ '🌱', '🌿', '🍀', '☘️', '🍄', '🌳', '🌲', '🌴', '🌵', '🌺', '🌷', '🌹', '🌻', '🪻', '🍁', '🍂', '🍃', '🌾', '🪵', '🪺', '🦚', '🦜', '🦔', '🐿️', '🦫', '🦡', '🦥', '🦨', '🦇', '🧚', '🧙', '🧞', '🔮', '🪄', '🧿', '🪬', '🪷', '🧩', '🗿', '🦁🦋' ]
};

const BASE_MPS = { 
    '바다알': 8, 
    '산알': 40, 
    '용암알': 320, 
    '하늘알': 2400, 
    '벚꽃알': 20000, 
    '우주알': 200000, 
    '천사알': 2000000, 
    '악마알': 20000000,
    '마법숲알': 100000000
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
    if ((eggName === '천사알' || eggName === '악마알' || eggName === '마법숲알') && index === totalLength - 1) return '디바인';
    let minRarityIdx = 0;
    if (eggName === '용암알') minRarityIdx = 1;
    if (eggName === '하늘알') minRarityIdx = 2;
    if (eggName === '벚꽃알') minRarityIdx = 2;
    if (eggName === '우주알') minRarityIdx = 2;
    if (eggName === '천사알' || eggName === '악마알') minRarityIdx = 3;
    if (eggName === '마법숲알') minRarityIdx = 3;

    const rarities = ['일반', '레어', '에픽', '전설', '신화', '코스믹', '비밀'];
    const available = rarities.slice(minRarityIdx);
    const ratio = index / Math.max(1, totalLength - 1);
    const chosenIdx = Math.min(available.length - 1, Math.floor(ratio * available.length));
    return available[chosenIdx];
}

const stagesState = STAGES.map(() => ({
    slots: Array.from({ length: 5 }, () => ({ busyBy: null, distanceProgress: 0, isGone: false, isError: false })),
    traps: []
}));

const userLocations = new Map();
const onlineUsers = new Map();
const userPrivateNotices = new Map(); // 💡 유저별 개인 알림 수신함 (선물 등)

let isNight = false;
let cycleTimer = 300;
let nightCount = 0;
let nextCosmicTarget = 7 + Math.floor(Math.random() * 4);
let nextSecretTarget = 18 + Math.floor(Math.random() * 5);

let globalSpecialEgg = null;
let upcomingSpecialType = null;
let upcomingSpecialStage = null;
let globalNotice = "";
let trapNotice = "";

let lastSoundEvent = { id: 0, sound: null };
let lastCutsceneEvent = { id: 0 };

const activeBuffs = {};
let adminSuperUpgrade = false;

let isErrorEvent = false;
let errorCycleTimer = 900;

function getBuffMult(type) {
    return (activeBuffs[type] && activeBuffs[type].timer > 0) ? activeBuffs[type].mult : 1;
}

function getDayDuration() {
    const halfMult = getBuffMult('dayHalf');
    if (halfMult === 4) return 75;
    if (halfMult === 2) return 150;
    return 300;
}

function updateErrorSlots() {
    const errorMult = getBuffMult('errorCount');
    const targetCount = Math.min(5, Math.max(1, 1 * errorMult));
    stagesState.forEach(st => {
        st.slots.forEach(s => s.isError = false);
        if (isErrorEvent) {
            for (let i = 0; i < targetCount; i++) {
                if (st.slots[i]) st.slots[i].isError = true;
            }
        }
    });
}

setInterval(() => {
    cycleTimer--;
    errorCycleTimer--;

    if (errorCycleTimer <= 0) {
        if (!isErrorEvent) {
            isErrorEvent = true;
            errorCycleTimer = 300;
            globalNotice = "⚠️ 시스템 에러 효과가 실행되었습니다!";
            lastSoundEvent = { id: Date.now(), sound: 'error' };
            updateErrorSlots();
            setTimeout(() => { if (globalNotice.includes("에러")) globalNotice = ""; }, 5000);
        } else {
            isErrorEvent = false;
            errorCycleTimer = 900;
            updateErrorSlots();
        }
    }

    for (const key in activeBuffs) {
        if (activeBuffs[key].timer > 0) {
            activeBuffs[key].timer--;
            if (activeBuffs[key].timer <= 0) {
                delete activeBuffs[key];
                if (key === 'errorCount') updateErrorSlots();
            }
        }
    }

    if (isNight && cycleTimer === 3) {
        if (!upcomingSpecialType) {
            if (nightCount >= nextSecretTarget) {
                upcomingSpecialType = 'secret';
                upcomingSpecialStage = Math.floor(Math.random() * STAGES.length);
                const lucky = getBuffMult('lucky');
                const baseInterval = 18 + Math.floor(Math.random() * 5);
                nextSecretTarget = nightCount + Math.max(2, Math.floor(baseInterval / lucky));
            } else if (nightCount >= nextCosmicTarget) {
                upcomingSpecialType = 'cosmic';
                upcomingSpecialStage = Math.floor(Math.random() * STAGES.length);
                const lucky = getBuffMult('lucky');
                const baseInterval = 7 + Math.floor(Math.random() * 4);
                nextCosmicTarget = nightCount + Math.max(1, Math.floor(baseInterval / lucky));
            }
        }
    }

    if (cycleTimer <= 0) {
        if (!isNight) {
            isNight = true;
            cycleTimer = 13;
            nightCount++;
            upcomingSpecialType = null;

            stagesState.forEach(st => {
                st.slots = Array.from({ length: 5 }, () => ({ busyBy: null, distanceProgress: 0, isGone: false, isError: false }));
            });
            updateErrorSlots();
        } else {
            isNight = false;
            cycleTimer = getDayDuration();

            if (upcomingSpecialType) {
                const sIdx = upcomingSpecialStage !== null ? upcomingSpecialStage : Math.floor(Math.random() * STAGES.length);
                const slotIdx = Math.floor(Math.random() * 5);
                if (upcomingSpecialType === 'cosmic') {
                    globalSpecialEgg = { type: 'cosmic', stageIndex: sIdx, slotIndex: slotIdx, eggName: `${STAGES[sIdx].name.split(' ')[1]}코스믹알` };
                    globalNotice = `🌌 [전체 공지] ${STAGES[sIdx].name}에 코스믹 알이 출현했습니다!`;
                } else if (upcomingSpecialType === 'secret') {
                    globalSpecialEgg = { type: 'secret', stageIndex: sIdx, slotIndex: slotIdx, eggName: `${STAGES[sIdx].name.split(' ')[1]}시크릿알` };
                    globalNotice = `🌑 [전체 공지] ${STAGES[sIdx].name}에 전설의 시크릿 알이 출현했습니다!`;
                }
            } else {
                globalNotice = "";
            }
            upcomingSpecialType = null;
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
        username, password, clickPower: 1, money: 10000, errorCoins: 0,
        inventory: ['기본 점핑패드', '트랩'], equipped: '기본 점핑패드', pets: [], equippedPets: [], claimedDex: [],
        installedTrapStage: null,
        isFirstLogin: true 
    };
    await db.collection('users').insertOne(newUser);
    res.json({ success: true, message: '회원가입 완료! 10,000원이 지급되었습니다. 로그인해주세요.' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await db.collection('users').findOne({ username, password });
    if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        sessions.set(token, username);
        res.cookie('auth_session', token, { maxAge: 1000 * 60 * 60 * 24, httpOnly: true });
        onlineUsers.set(username, Date.now()); 
        res.json({ success: true });
    } else {
        res.json({ success: false, message: '이름 또는 비밀번호가 틀렸습니다.' });
    }
});

app.post('/api/logout', (req, res) => { 
    const token = req.cookies.auth_session;
    if (token) {
        const username = sessions.get(token);
        sessions.delete(token);
        if (username) {
            onlineUsers.delete(username);
            userLocations.delete(username);
            userPrivateNotices.delete(username);
        }
    }
    res.clearCookie('auth_session'); 
    res.json({ success: true }); 
});

app.get('/api/userdata', async (req, res) => {
    const username = authenticateUser(req);
    if (!username) return res.json({ success: false });
    const user = await db.collection('users').findOne({ username });
    if (user) {
        onlineUsers.set(username, Date.now()); 
        if (!user.clickPower) user.clickPower = 1;
        if (!user.pets) user.pets = [];
        if (!user.equippedPets) user.equippedPets = [];
        if (!user.claimedDex) user.claimedDex = [];
        if (user.errorCoins === undefined) user.errorCoins = 0;
        if (!user.inventory.includes('트랩') && user.installedTrapStage === null) {
            user.inventory.push('트랩');
        }
        res.json({ 
            success: true, 
            user, 
            isAdmin: username === '작자', 
            adminSuperUpgrade,
            currentCutsceneId: lastCutsceneEvent.id // 💡 로그인 시점 최신 컷신 ID 전달
        });
    } else res.json({ success: false });
});

app.post('/api/finish_intro', async (req, res) => {
    const username = authenticateUser(req);
    if (username) await db.collection('users').updateOne({ username }, { $set: { isFirstLogin: false } });
    res.json({ success: true });
});

app.post('/api/sync_stage', async (req, res) => {
    const username = authenticateUser(req);
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

    // 💡 개인 알림 추출 (선물 수신 등)
    let privateNotice = "";
    if (userPrivateNotices.has(username)) {
        privateNotice = userPrivateNotices.get(username);
        userPrivateNotices.delete(username);
    }

    // 💡 실시간 인벤토리 및 펫 동기화 (받은 선물 즉각 반영)
    const userDoc = await db.collection('users').findOne({ username }, { projection: { inventory: 1, pets: 1, equippedPets: 1 } });

    res.json({
        success: true,
        isNight,
        cycleTimer,
        isErrorEvent,
        errorCycleTimer,
        upcomingSpecialType,
        globalNotice,
        privateNotice,
        trapNotice,
        globalSpecialEgg,
        usersInStage,
        activeBuffs,
        adminSuperUpgrade,
        lastSoundEvent,
        lastCutsceneEvent,
        inventory: userDoc ? userDoc.inventory : [],
        pets: userDoc ? userDoc.pets : [],
        equippedPets: userDoc ? userDoc.equippedPets : [],
        slots: currentStageState ? currentStageState.slots : []
    });
});

// 💡 선물 보내기: 받는 사람에게만 개인 알림 부여 및 DB 즉시 교환
app.post('/api/send_gift', async (req, res) => {
    const senderName = authenticateUser(req);
    const { targetUser, giftType, itemId } = req.body;
    if (!senderName) return res.json({ success: false, message: '인증 실패' });
    if (senderName === targetUser) return res.json({ success: false, message: '자신에게는 보낼 수 없습니다.' });

    const sender = await db.collection('users').findOne({ username: senderName });
    const receiver = await db.collection('users').findOne({ username: targetUser });
    if (!receiver) return res.json({ success: false, message: '상대방 유저를 찾을 수 없습니다.' });

    let sentItemName = '';
    if (giftType === 'egg') {
        const eggIdx = sender.inventory.indexOf(itemId);
        if (eggIdx === -1) return res.json({ success: false, message: '보유하지 않은 알입니다.' });
        sender.inventory.splice(eggIdx, 1);
        receiver.inventory.push(itemId);
        sentItemName = itemId;
    } else if (giftType === 'pet') {
        const petIdx = sender.pets.findIndex(p => p.id === itemId);
        if (petIdx === -1) return res.json({ success: false, message: '보유하지 않은 동물입니다.' });
        const petObj = sender.pets.splice(petIdx, 1)[0];
        sender.equippedPets = (sender.equippedPets || []).filter(id => id !== itemId);
        receiver.pets.push(petObj);
        sentItemName = `${petObj.emoji} (${petObj.rarity})`;
    } else {
        return res.json({ success: false, message: '잘못된 선물 유형입니다.' });
    }

    await db.collection('users').updateOne({ username: senderName }, {
        $set: { inventory: sender.inventory, pets: sender.pets, equippedPets: sender.equippedPets }
    });
    await db.collection('users').updateOne({ username: targetUser }, {
        $set: { inventory: receiver.inventory, pets: receiver.pets }
    });

    // 💡 받는 사람에게만 알림 저장
    userPrivateNotices.set(targetUser, `🎁 [${senderName}] 님이 ${sentItemName}을(를) 선물로 보냈습니다!`);

    res.json({ success: true, inventory: sender.inventory, pets: sender.pets, equippedPets: sender.equippedPets });
});

app.post('/api/admin/broadcast', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    const { text } = req.body;
    globalNotice = `📢 [관리자 작자]: ${text}`;
    lastSoundEvent = { id: Date.now(), sound: 'adminchat' };
    setTimeout(() => { 
        if (globalNotice === `📢 [관리자 작자]: ${text}`) globalNotice = ""; 
    }, 4000);
    res.json({ success: true });
});

app.post('/api/admin/spawn_special', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    const { type, stageIndex } = req.body;
    const slotIdx = Math.floor(Math.random() * 5);
    const stagePrefix = STAGES[stageIndex].name.split(' ')[1];
    let eggName = `${stagePrefix}${type === 'cosmic' ? '코스믹알' : type === 'secret' ? '시크릿알' : '디바인알'}`;
    
    globalSpecialEgg = { type, stageIndex, slotIndex: slotIdx, eggName };
    globalNotice = `📢 작자가 [${STAGES[stageIndex].name}]에 ${type === 'cosmic' ? '코스믹 알' : type === 'secret' ? '시크릿 알' : '디바인 알'}을 생성했습니다!`;
    lastSoundEvent = { id: Date.now(), sound: type === 'cosmic' ? 'cosmic' : type === 'secret' ? 'secret' : 'admineffect' };
    res.json({ success: true, eggName, stageIndex, slotIndex: slotIdx });
});

app.post('/api/admin/trigger_buff', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    const { buffType, mult } = req.body;

    const currentTimer = (activeBuffs[buffType] && activeBuffs[buffType].timer > 0) ? activeBuffs[buffType].timer : 0;
    activeBuffs[buffType] = { 
        mult: parseInt(mult), 
        timer: currentTimer + 300 
    };

    if (buffType === 'dayHalf' && !isNight) {
        cycleTimer = Math.min(cycleTimer, getDayDuration());
    }
    if (buffType === 'errorCount') {
        updateErrorSlots();
    }

    lastSoundEvent = { id: Date.now(), sound: 'admineffect' };
    res.json({ success: true, activeBuffs });
});

app.post('/api/admin/trigger_error_event', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    isErrorEvent = true;
    errorCycleTimer = 300;
    updateErrorSlots();
    globalNotice = "📢 작자가 에러 효과를 실행했습니다!";
    lastSoundEvent = { id: Date.now(), sound: 'error' };
    setTimeout(() => { if (globalNotice.includes("작자가 에러")) globalNotice = ""; }, 5000);
    res.json({ success: true });
});

app.post('/api/admin/trigger_cutscene', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    lastCutsceneEvent = { id: Date.now() }; // 새로운 ID 발급
    res.json({ success: true });
});

app.post('/api/admin/toggle_super_upgrade', (req, res) => {
    const username = authenticateUser(req);
    if (username !== '작자') return res.status(403).json({ success: false, message: '권한이 없습니다.' });
    adminSuperUpgrade = !adminSuperUpgrade;

    if (adminSuperUpgrade) {
        globalNotice = `📢 작자가 관리자 강화를 생성했습니다!`;
        lastSoundEvent = { id: Date.now(), sound: 'admineffect' };
        setTimeout(() => {
            if (globalNotice === `📢 작자가 관리자 강화를 생성했습니다!`) globalNotice = "";
        }, 4000);
    }

    res.json({ success: true, adminSuperUpgrade });
});

app.post('/api/upgrade_step', async (req, res) => {
    const username = authenticateUser(req);
    if (!username) return res.json({ success: false });
    const increment = adminSuperUpgrade ? 3 : 1;
    await db.collection('users').updateOne({ username }, { $inc: { clickPower: increment } });
    const updated = await db.collection('users').findOne({ username }, { projection: { clickPower: 1 } });
    res.json({ success: true, clickPower: updated.clickPower });
});

app.post('/api/trap_install', async (req, res) => {
    const username = authenticateUser(req);
    const { stageIndex } = req.body;
    if (!username) return res.json({ success: false, message: '인증 실패' });

    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false });

    if (user.installedTrapStage !== null && user.installedTrapStage !== undefined) {
        return res.json({ success: false, message: '이미 설치된 트랩이 있습니다. 회수 후 다시 설치하세요.' });
    }

    const trapIdx = user.inventory.indexOf('트랩');
    if (trapIdx === -1) return res.json({ success: false, message: '트랩을 보유하고 있지 않습니다.' });

    user.inventory.splice(trapIdx, 1);
    stagesState[stageIndex].traps.push({ owner: username });

    await db.collection('users').updateOne({ username }, {
        $set: { inventory: user.inventory, installedTrapStage: stageIndex }
    });

    res.json({ success: true, inventory: user.inventory, installedTrapStage: stageIndex });
});

app.post('/api/trap_recall', async (req, res) => {
    const username = authenticateUser(req);
    if (!username) return res.json({ success: false, message: '인증 실패' });

    const user = await db.collection('users').findOne({ username });
    if (!user || user.installedTrapStage === null || user.installedTrapStage === undefined) {
        return res.json({ success: false, message: '회수할 트랩이 없습니다.' });
    }

    const sIdx = user.installedTrapStage;
    stagesState[sIdx].traps = stagesState[sIdx].traps.filter(t => t.owner !== username);

    user.inventory.push('트랩');
    await db.collection('users').updateOne({ username }, {
        $set: { inventory: user.inventory, installedTrapStage: null }
    });

    res.json({ success: true, inventory: user.inventory, installedTrapStage: null });
});

app.post('/api/start_steal', (req, res) => {
    const username = authenticateUser(req);
    const { stageIndex, slotIndex } = req.body;
    if (!username) return res.json({ success: false, message: '로그인이 필요합니다.' });
    if (isNight) return res.json({ success: false, message: '밤에는 알을 훔칠 수 없습니다!' });

    if (stageIndex < 0 || stageIndex >= stagesState.length || slotIndex < 0 || slotIndex >= 5) {
        return res.json({ success: false, message: '잘못된 슬롯입니다.' });
    }

    const stageTraps = stagesState[stageIndex].traps.filter(t => t.owner !== username);
    if (stageTraps.length > 0 && Math.random() < 0.1) {
        trapNotice = `🚨 [${username}] 님이 [${STAGES[stageIndex].name}]에서 트랩에 걸렸습니다!`;
        setTimeout(() => { trapNotice = ""; }, 5000);
        return res.json({ success: false, trapped: true, message: '덜컥! 누군가 설치한 덫에 걸렸습니다! 5초간 행동 불능이 되며 로비로 추방됩니다.' });
    }

    const slot = stagesState[stageIndex].slots[slotIndex];
    if (slot.isGone) return res.json({ success: false, message: '이미 훔쳐간 알입니다!' });
    if (slot.busyBy && slot.busyBy !== username) return res.json({ success: false, message: `${slot.busyBy} 님이 이미 훔치는 중입니다!` });

    slot.busyBy = username;

    const totalEscape = STAGES[stageIndex].escapeClicks;
    const savedDistance = slot.distanceProgress || 0;
    const remainingClicks = Math.max(50, totalEscape - savedDistance);

    res.json({ success: true, savedDistance, targetEscapeClicks: remainingClicks, isError: !!slot.isError });
});

app.post('/api/cancel_steal', (req, res) => {
    const username = authenticateUser(req);
    const { stageIndex, slotIndex } = req.body;
    if (username && stageIndex >= 0 && stageIndex < stagesState.length && slotIndex >= 0 && slotIndex < 5) {
        const slot = stagesState[stageIndex].slots[slotIndex];
        if (slot.busyBy === username) slot.busyBy = null;
    }
    res.json({ success: true });
});

app.post('/api/fail_steal', (req, res) => {
    const username = authenticateUser(req);
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
    const username = authenticateUser(req);
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

    const moneyMult = getBuffMult('money');
    totalMps *= moneyMult;

    const newMoney = user.money + totalMps;
    await db.collection('users').updateOne({ username }, { $set: { money: newMoney } });
    res.json({ success: true, money: newMoney, clickPower: user.clickPower || 1, errorCoins: user.errorCoins || 0, mps: totalMps });
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

app.post('/api/error_gacha', async (req, res) => {
    const username = authenticateUser(req);
    if (!username) return res.json({ success: false, message: '인증 실패' });

    const user = await db.collection('users').findOne({ username });
    if (!user || (user.errorCoins || 0) < 1000) {
        return res.json({ success: false, message: '에러코인이 부족합니다! (필요: 1,000개)' });
    }

    user.errorCoins -= 1000;

    const rand = Math.random() * 100;
    let rewardType = '';
    let rewardDetail = '';

    if (rand < 50.0) {
        rewardType = 'money';
        const factor = Math.pow(Math.random(), 3.5);
        const amount = Math.floor(5000 + factor * 995000);
        user.money += amount;
        rewardDetail = `${amount.toLocaleString()}원`;
    } else if (rand < 92.5) {
        rewardType = 'power';
        const factor = Math.pow(Math.random(), 3.0);
        const amount = Math.floor(100 + factor * 4900);
        user.clickPower = (user.clickPower || 1) + amount;
        rewardDetail = `클릭 파워 +${amount.toLocaleString()}`;
    } else if (rand < 99.5) {
        rewardType = 'cosmic_egg';
        const s = STAGES[Math.floor(Math.random() * STAGES.length)];
        const eggName = `${s.name.split(' ')[1]}코스믹알`;
        user.inventory.push(eggName);
        rewardDetail = `[${eggName}]`;
    } else {
        rewardType = 'error_egg';
        user.inventory.push('에러알');
        rewardDetail = `[에러알] 획득!`;
    }

    await db.collection('users').updateOne({ username }, {
        $set: { 
            errorCoins: user.errorCoins,
            money: user.money,
            clickPower: user.clickPower,
            inventory: user.inventory
        }
    });

    res.json({
        success: true,
        rewardType,
        rewardDetail,
        errorCoins: user.errorCoins,
        money: user.money,
        clickPower: user.clickPower,
        inventory: user.inventory
    });
});

app.post('/api/hatch', async (req, res) => {
    const username = authenticateUser(req);
    const { eggName } = req.body;
    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    const eggIndex = user.inventory.indexOf(eggName);
    if (eggIndex === -1) return res.json({ success: false, message: '알이 존재하지 않습니다.' });

    user.inventory.splice(eggIndex, 1);

    let pickedEmoji = '❓';
    let rarity = '일반';
    let baseMps = 10;
    let actualSourceEgg = eggName;

    if (eggName.includes('디바인알')) {
        const stagePrefix = eggName.replace('디바인알', '');
        const matchedStage = STAGES.find(s => s.name.includes(stagePrefix)) || STAGES[6];
        actualSourceEgg = matchedStage.eggName;
        const pool = PET_POOLS[actualSourceEgg];
        pickedEmoji = pool[pool.length - 1];
        rarity = '디바인';
        baseMps = BASE_MPS[actualSourceEgg] * 10;
    } else if (eggName === '에러알') {
        const isSecret = Math.random() < 0.1;
        pickedEmoji = isSecret ? '☠️' : '🦠';
        rarity = isSecret ? '비밀' : '코스믹';
        baseMps = isSecret ? 250000000 : 35000000;
        actualSourceEgg = '악마알';
    } else if (eggName.includes('코스믹알') || eggName.includes('시크릿알')) {
        const isCosmic = eggName.includes('코스믹알');
        const stagePrefix = eggName.replace('코스믹알', '').replace('시크릿알', '');
        const matchedStage = STAGES.find(s => s.name.includes(stagePrefix)) || STAGES[0];
        actualSourceEgg = matchedStage.eggName;
        const pool = PET_POOLS[actualSourceEgg];

        const targetRarity = isCosmic ? '코스믹' : '비밀';
        const candidateIndices = [];
        pool.forEach((em, idx) => {
            if (getPetRarity(actualSourceEgg, idx, pool.length) === targetRarity) {
                candidateIndices.push(idx);
            }
        });

        const chosenIdx = candidateIndices.length > 0 
            ? candidateIndices[Math.floor(Math.random() * candidateIndices.length)] 
            : pool.length - 2;

        pickedEmoji = pool[chosenIdx];
        rarity = targetRarity;
        baseMps = Math.floor(BASE_MPS[actualSourceEgg] * Math.pow(1.45, chosenIdx));
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
    
    const isWeightBuff = getBuffMult('weightBuff') > 1;
    let rawWeight = 1.0 + Math.pow(Math.random(), 4) * 9999.0;
    if (isWeightBuff && Math.random() < 0.15) {
        rawWeight = 1500.0 + Math.random() * 3500.0;
    }

    const weight = Math.round(rawWeight * 10) / 10;
    const weightBonus = 1 + (weight * 0.002);
    const mps = Math.floor(baseMps * weightBonus);
    
    const newPet = { 
        id: Date.now() + Math.floor(Math.random()*1000), 
        emoji: pickedEmoji, 
        eggSource: actualSourceEgg, 
        mps: mps,
        weight: weight,
        rarity: rarity
    };
    user.pets.push(newPet);

    await db.collection('users').updateOne({ username }, { $set: { inventory: user.inventory, pets: user.pets } });
    res.json({ success: true, newPet, inventory: user.inventory, pets: user.pets });
});

app.post('/api/claim_dex', async (req, res) => {
    const username = authenticateUser(req);
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
    const username = authenticateUser(req);
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
    const username = authenticateUser(req);
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
    const username = authenticateUser(req);
    const { stageIndex, slotIndex, isSpecial, specialType } = req.body;
    
    if (stageIndex === undefined || stageIndex < 0 || stageIndex >= STAGES.length) {
        return res.json({ success: false, message: '비정상적인 접근입니다.' });
    }

    const slot = stagesState[stageIndex].slots[slotIndex];
    if (!slot || slot.busyBy !== username) {
        return res.json({ success: false, message: '잘못된 탈출 검증 요청입니다.' });
    }

    const user = await db.collection('users').findOne({ username });
    if (!user) return res.json({ success: false, message: '유저를 찾을 수 없습니다.' });

    let eggToGive = STAGES[stageIndex].eggName;
    let earnedCoins = 0;

    if (slot.isError) {
        earnedCoins = 100;
        user.errorCoins = (user.errorCoins || 0) + 100;
    }

    if (isSpecial) {
        if (!globalSpecialEgg || globalSpecialEgg.stageIndex !== stageIndex || globalSpecialEgg.slotIndex !== slotIndex || globalSpecialEgg.type !== specialType) {
            return res.json({ success: false, message: '존재하지 않는 스페셜 알입니다.' });
        }
        eggToGive = globalSpecialEgg.eggName;
        globalSpecialEgg = null;
    }

    slot.busyBy = null;
    slot.distanceProgress = 0;
    slot.isGone = true;

    user.inventory.push(eggToGive);
    await db.collection('users').updateOne({ username }, { 
        $set: { inventory: user.inventory, errorCoins: user.errorCoins } 
    });

    res.json({ 
        success: true, 
        eggName: eggToGive, 
        inventory: user.inventory,
        earnedCoins,
        errorCoins: user.errorCoins 
    });
});

app.post('/api/equip', async (req, res) => {
    const username = authenticateUser(req);
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

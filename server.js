const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const users = new Map();
const activeGames = new Map();
const pending3Games = new Map();
const socketToUser = new Map();
const userRoom = new Map();

const suits = ['♥', '♦', '♣', '♠'];
const suitNames = { '♥': 'hearts', '♦': 'diamonds', '♣': 'clubs', '♠': 'spades' };
const cardValues = ['6', '7', '8', '9', '10', 'В', 'Д', 'К', 'Т'];
const cardRanks = {'6':0,'7':1,'8':2,'9':3,'10':4,'В':5,'Д':6,'К':7,'Т':8};

const TRUMP_SUIT = '♦';
const START_CARDS = 12;

function createDeck() {
    let deck = [];
    for (let suit of suits) {
        for (let i = 0; i < cardValues.length; i++) {
            deck.push({
                id: suit + '_' + cardValues[i] + '_' + Math.random(),
                suit: suit,
                suitEng: suitNames[suit],
                name: cardValues[i],
                rank: cardRanks[cardValues[i]],
                isTrump: (suit === TRUMP_SUIT)
            });
        }
    }
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function canBeat(defendingCard, attackingCard) {
    if (attackingCard.suit === '♠') {
        if (defendingCard.suit === '♠' && defendingCard.rank > attackingCard.rank) {
            return true;
        }
        return false;
    }
    if (defendingCard.suit === TRUMP_SUIT && attackingCard.suit !== TRUMP_SUIT) {
        return true;
    }
    if (defendingCard.suit === attackingCard.suit && defendingCard.rank > attackingCard.rank) {
        return true;
    }
    return false;
}

class GameRoom {
    constructor(roomId, playersList, gameType) {
        this.roomId = roomId;
        this.gameType = gameType;
        this.players = playersList.map(p => ({ id: p, name: p, hand: [], isActive: true, place: null }));
        this.deck = [];
        this.trumpSuit = TRUMP_SUIT;
        this.trumpCard = null;
        this.currentAttacker = 0;
        this.currentDefender = 1;
        this.tableCards = [];
        this.gameStarted = false;
        this.results = [];
        this.phase = 'attacking';
        this.maxCardsOnTable = 6;
        this.lastDefendWasLady = false;
        this.attackCardRank = null;
        this.nextPlace = 1;
        this.wasTake = false;
    }

    startGame() {
        if (this.players.length < 2) return false;
        this.deck = createDeck();
        
        for (let i = 0; i < this.players.length; i++) {
            this.players[i].hand = this.deck.splice(0, START_CARDS);
            this.players[i].isActive = true;
            this.players[i].place = null;
            console.log('Игрок ' + this.players[i].name + ' получил ' + this.players[i].hand.length + ' карт');
        }
        
        this.trumpCard = { suit: this.trumpSuit, name: 'Козырь' };

        this.currentAttacker = Math.floor(Math.random() * this.players.length);
        this.currentDefender = (this.currentAttacker + 1) % this.players.length;
        
        this.gameStarted = true;
        this.tableCards = [];
        this.phase = 'attacking';
        this.lastDefendWasLady = false;
        this.attackCardRank = null;
        this.results = [];
        this.nextPlace = 1;
        this.wasTake = false;
        
        console.log('Игра началась! Первый атакует: ' + this.players[this.currentAttacker].name);
        console.log('Защищается: ' + this.players[this.currentDefender].name);
        return true;
    }

    getPlayerHand(username) {
        const p = this.players.find(p => p.id === username);
        return p ? [...p.hand] : [];
    }

    canAddCard(card) {
        for (let t of this.tableCards) {
            if (t.card.name === card.name) return true;
            if (t.defendedByCard && t.defendedByCard.name === card.name) return true;
        }
        return false;
    }

    canPlayerAct(playerIdx) {
        return this.players[playerIdx].isActive && this.players[playerIdx].hand.length > 0;
    }

    getNextActivePlayer(startIndex, direction = 1) {
        let nextIndex = (startIndex + direction) % this.players.length;
        let attempts = 0;
        while ((!this.players[nextIndex].isActive || this.players[nextIndex].hand.length === 0) && attempts < this.players.length) {
            nextIndex = (nextIndex + direction) % this.players.length;
            attempts++;
        }
        return nextIndex;
    }

    getEligibleAddPlayers() {
        const eligible = this.players.filter((p, idx) => 
            idx !== this.currentDefender && 
            this.canPlayerAct(idx) && 
            p.hand.length > 0
        );
        console.log('=== Игроки, которые могут подкидывать ===');
        for (let p of eligible) {
            console.log('  - ' + p.name + ' (карт: ' + p.hand.length + ')');
        }
        return eligible;
    }

    broadcastGameState() {
        const newState = this.getGameState();
        for (let player of this.players) {
            const user = users.get(player.id);
            if (user && user.online) {
                io.to(user.socketId).emit('gameState', newState);
                io.to(user.socketId).emit('playerHand', this.getPlayerHand(player.id));
            }
        }
    }

    playerAttack(username, cardId) {
        const pIdx = this.players.findIndex(p => p.id === username);
        if (!this.canPlayerAct(pIdx)) {
            console.log('❌ ' + username + ' НЕ может атаковать (не активен или нет карт)');
            return false;
        }
        if (pIdx !== this.currentAttacker) {
            console.log('❌ ' + username + ' не является атакующим (атакует: ' + this.players[this.currentAttacker].name + ')');
            return false;
        }
        if (this.phase !== 'attacking') {
            console.log('❌ ' + username + ' не может атаковать (фаза: ' + this.phase + ')');
            return false;
        }
        if (this.tableCards.length > 0) {
            console.log('❌ ' + username + ' не может атаковать (на столе уже есть карты)');
            return false;
        }

        const cardIdx = this.players[pIdx].hand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return false;
        const card = this.players[pIdx].hand[cardIdx];

        this.tableCards.push({ card: card, defendedByCard: null });
        this.players[pIdx].hand.splice(cardIdx, 1);
        this.phase = 'defending';
        this.attackCardRank = card.name;
        console.log('⚔️ АТАКА: ' + username + ' кинул ' + card.name + card.suit + ' на ' + this.players[this.currentDefender].name);
        
        this.checkAndHandleWinner();
        
        // ★★★ ЕСЛИ ПОБЕДИТЕЛЬ НАЙДЕН ВО ВРЕМЯ АТАКИ, ЗАВЕРШАЕМ ХОД ★★★
        if (this.gameStarted === false) {
            console.log('🏆 Игра окончена из-за победы игрока!');
            return true;
        }
        
        this.broadcastGameState();
        return true;
    }

    playerDefend(username, defendCardId) {
        const pIdx = this.players.findIndex(p => p.id === username);
        if (!this.canPlayerAct(pIdx)) {
            console.log('❌ ' + username + ' НЕ может защищаться (не активен или нет карт)');
            return false;
        }
        if (pIdx !== this.currentDefender) {
            console.log('❌ ' + username + ' не является защищающимся (защищается: ' + this.players[this.currentDefender].name + ')');
            return false;
        }
        if (this.phase !== 'defending') {
            console.log('❌ ' + username + ' не может защищаться (фаза: ' + this.phase + ')');
            return false;
        }

        let undefendedIndex = -1;
        for (let i = 0; i < this.tableCards.length; i++) {
            if (this.tableCards[i].defendedByCard === null) {
                undefendedIndex = i;
                break;
            }
        }
        if (undefendedIndex === -1) return false;

        const attackCardObj = this.tableCards[undefendedIndex];
        const cardIdx = this.players[pIdx].hand.findIndex(c => c.id === defendCardId);
        if (cardIdx === -1) return false;
        const defendCard = this.players[pIdx].hand[cardIdx];

        console.log('🛡️ ЗАЩИТА: ' + username + ' пытается отбить ' + attackCardObj.card.name + attackCardObj.card.suit + ' картой ' + defendCard.name + defendCard.suit);

        if (canBeat(defendCard, attackCardObj.card)) {
            attackCardObj.defendedByCard = defendCard;
            this.players[pIdx].hand.splice(cardIdx, 1);
            console.log('✅ ЗАЩИТА УСПЕШНА: ' + username + ' отбил ' + attackCardObj.card.name + attackCardObj.card.suit + ' картой ' + defendCard.name + defendCard.suit);
            
            if (defendCard.name === 'Д') {
                this.lastDefendWasLady = true;
                this.phase = 'finished';
                console.log('👑 ЗАЩИТА ДАМОЙ - ход завершён!');
                this.checkAndHandleWinner();
                this.broadcastGameState();
                return true;
            }
            
            let allDefended = this.tableCards.every(c => c.defendedByCard !== null);
            if (allDefended) {
                const eligiblePlayers = this.getEligibleAddPlayers();
                if (eligiblePlayers.length > 0) {
                    this.phase = 'adding';
                    console.log('📤 Все карты отбиты, можно подкидывать');
                } else {
                    this.phase = 'finished';
                    console.log('📤 Все карты отбиты, но подкидывать некому - ход завершён');
                }
            }
            this.checkAndHandleWinner();
            this.broadcastGameState();
            return true;
        } else {
            console.log('❌ ЗАЩИТА НЕУДАЧНА: ' + defendCard.name + defendCard.suit + ' НЕ бьёт ' + attackCardObj.card.name + attackCardObj.card.suit);
        }
        return false;
    }

    playerAdd(username, cardId) {
        const pIdx = this.players.findIndex(p => p.id === username);
        
        if (this.players[pIdx].hand.length === 0) {
            console.log('❌ ' + username + ' не может подкидывать - у него нет карт!');
            return false;
        }
        
        if (!this.canPlayerAct(pIdx)) {
            console.log('❌ ' + username + ' НЕ может подкидывать (не активен или нет карт)');
            return false;
        }
        if (this.phase !== 'adding') {
            console.log('❌ ' + username + ' не может подкидывать (фаза: ' + this.phase + ')');
            return false;
        }
        if (pIdx === this.currentDefender) {
            console.log('❌ ' + username + ' не может подкидывать (он защищается)');
            return false;
        }
        if (this.tableCards.length >= this.maxCardsOnTable) {
            console.log('❌ ' + username + ' не может подкидывать (максимум карт на столе: ' + this.maxCardsOnTable + ')');
            return false;
        }

        const cardIdx = this.players[pIdx].hand.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return false;
        const card = this.players[pIdx].hand[cardIdx];

        if (this.canAddCard(card)) {
            console.log('📤 ПОДКИДЫВАНИЕ: ' + username + ' подкинул ' + card.name + card.suit);
            
            this.players[pIdx].hand.splice(cardIdx, 1);
            this.checkAndHandleWinner();
            
            if (this.players[pIdx].hand.length === 0 && !this.players[pIdx].isActive) {
                console.log('⚠️ ' + username + ' выиграл! Карта НЕ добавляется на стол.');
                this.phase = 'finished';
                this.broadcastGameState();
                return true;
            }
            
            this.tableCards.push({ card: card, defendedByCard: null });
            this.phase = 'defending';
            
            this.broadcastGameState();
            return true;
        } else {
            console.log('❌ ПОДКИДЫВАНИЕ НЕВОЗМОЖНО: номинал ' + card.name + card.suit + ' отсутствует на столе');
        }
        return false;
    }

    playerTake(username) {
        const pIdx = this.players.findIndex(p => p.id === username);
        if (!this.canPlayerAct(pIdx)) return false;
        if (pIdx !== this.currentDefender) return false;
        if (this.phase !== 'defending') return false;

        const oldCount = this.players[pIdx].hand.length;
        let takenCount = 0;
        
        console.log('📥 ' + username + ' берёт карты со стола:');
        for (let t of this.tableCards) {
            this.players[pIdx].hand.push(t.card);
            takenCount++;
            console.log('   - взял атакующую карту ' + t.card.name + t.card.suit);
            if (t.defendedByCard) {
                this.players[pIdx].hand.push(t.defendedByCard);
                takenCount++;
                console.log('   - взял защитную карту ' + t.defendedByCard.name + t.defendedByCard.suit);
            }
        }
        
        console.log('📥 ИТОГО: ' + username + ' взял ' + takenCount + ' карт (было ' + oldCount + ', стало ' + (oldCount + takenCount) + ')');
        
        this.tableCards = [];
        this.phase = 'finished';
        this.wasTake = true;
        
        this.checkAndHandleWinner();
        this.broadcastGameState();
        return true;
    }

    finishAdding() {
        if (this.phase !== 'adding') return false;
        
        const eligiblePlayers = this.getEligibleAddPlayers();
        if (eligiblePlayers.length === 0 || eligiblePlayers.every(p => p.hand.length === 0)) {
            this.phase = 'finished';
            console.log('✅ Подкидывание завершено (некому подкидывать)');
            this.broadcastGameState();
            return true;
        }
        
        this.tableCards = [];
        this.phase = 'finished';
        console.log('✅ Подкидывание завершено по желанию игрока');
        this.broadcastGameState();
        return true;
    }

    nextTurn() {
        console.log('=== НОВЫЙ ХОД ===');
        console.log('Текущая фаза: ' + this.phase);
        
        if (this.phase !== 'finished') {
            console.log('❌ Нельзя начать новый ход (фаза: ' + this.phase + ')');
            return false;
        }
        
        let nextAttacker;
        
        if (this.lastDefendWasLady) {
            nextAttacker = this.currentDefender;
            this.lastDefendWasLady = false;
            console.log('👑 Защита дамой - атакующим становится ' + this.players[nextAttacker].name);
        } else if (this.wasTake) {
            nextAttacker = this.getNextActivePlayer(this.currentDefender, 1);
            this.wasTake = false;
            console.log('📥 Игрок взял карты - атакующим становится следующий: ' + this.players[nextAttacker].name);
        } else {
            nextAttacker = this.currentDefender;
            console.log('✅ Игрок покрылся - атакующим становится ' + this.players[nextAttacker].name);
        }
        
        let attempts = 0;
        while (!this.canPlayerAct(nextAttacker) && attempts < this.players.length) {
            nextAttacker = this.getNextActivePlayer(nextAttacker, 1);
            attempts++;
        }
        
        this.currentAttacker = nextAttacker;
        
        let nextDefender = (this.currentAttacker + 1) % this.players.length;
        attempts = 0;
        while (!this.canPlayerAct(nextDefender) && attempts < this.players.length) {
            nextDefender = (nextDefender + 1) % this.players.length;
            attempts++;
        }
        this.currentDefender = nextDefender;
        
        if (this.currentAttacker === this.currentDefender || 
            !this.canPlayerAct(this.currentAttacker) || 
            !this.canPlayerAct(this.currentDefender)) {
            console.log('🏆 Игра окончена!');
            this.gameStarted = false;
            return false;
        }
        
        this.tableCards = [];
        this.phase = 'attacking';
        this.attackCardRank = null;
        
        console.log('🎮 НОВЫЙ ХОД:');
        console.log('  ⚔️ Атакует: ' + this.players[this.currentAttacker].name + ' (карт: ' + this.players[this.currentAttacker].hand.length + ')');
        console.log('  🛡️ Защищается: ' + this.players[this.currentDefender].name + ' (карт: ' + this.players[this.currentDefender].hand.length + ')');
        
        this.broadcastGameState();
        return true;
    }

    checkAndHandleWinner() {
        let winnerFound = false;
        
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].hand.length === 0 && this.players[i].isActive) {
                this.players[i].isActive = false;
                this.players[i].place = this.nextPlace;
                this.results.push({ name: this.players[i].name, place: this.nextPlace });
                console.log('🏆 ' + this.players[i].name + ' занял ' + this.nextPlace + ' место и выбыл из игры!');
                this.nextPlace++;
                winnerFound = true;
            }
        }
        
        // ★★★ ЕСЛИ ВЫЯВЛЕН ПОБЕДИТЕЛЬ, ЗАВЕРШАЕМ ФАЗУ ★★★
        if (winnerFound) {
            console.log('⚠️ ВНИМАНИЕ: Выявлен победитель! Завершаем текущую фазу.');
            this.phase = 'finished';
            this.broadcastGameState();
        }
        
        let activeCount = this.players.filter(p => p.isActive).length;
        
        if (activeCount === 1) {
            let lastPlayer = this.players.find(p => p.isActive);
            if (lastPlayer) {
                lastPlayer.isActive = false;
                lastPlayer.place = this.nextPlace;
                this.results.push({ name: lastPlayer.name, place: this.nextPlace });
                console.log('🏆 ' + lastPlayer.name + ' занял ' + this.nextPlace + ' место!');
            }
            this.gameStarted = false;
        }
    }

    checkWinner() {
        this.checkAndHandleWinner();
        return this.gameStarted === false;
    }

    getGameState() {
        const attackCards = [];
        const defendCards = [];
        for (let t of this.tableCards) {
            attackCards.push(t.card);
            defendCards.push(t.defendedByCard || null);
        }
        
        return {
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                handCount: p.hand.length,
                isActive: p.isActive,
                place: p.place
            })),
            currentAttacker: this.currentAttacker,
            currentDefender: this.currentDefender,
            attackCards: attackCards,
            defendCards: defendCards,
            trumpSuit: this.trumpSuit,
            trumpCard: this.trumpCard,
            gameStarted: this.gameStarted,
            results: this.results,
            phase: this.phase,
            gameType: this.gameType,
            attackCardRank: this.attackCardRank,
            deckCount: this.deck.length
        };
    }
}

io.on('connection', (socket) => {
    console.log('Подключился:', socket.id);
    let currentUser = null;

    socket.on('register', ({ username, password }) => {
        if (users.has(username)) {
            socket.emit('registerResult', { success: false, message: 'Имя занято' });
        } else {
            users.set(username, { password, socketId: socket.id, online: true, inGame: false });
            currentUser = username;
            socketToUser.set(socket.id, username);
            socket.emit('registerResult', { success: true, message: 'Регистрация успешна!' });
            updateOnlineList();
        }
    });

    socket.on('login', ({ username, password }) => {
        const user = users.get(username);
        if (user && user.password === password) {
            user.socketId = socket.id;
            user.online = true;
            currentUser = username;
            socketToUser.set(socket.id, username);
            socket.emit('loginResult', { success: true, message: 'Вход выполнен!' });
            updateOnlineList();
        } else {
            socket.emit('loginResult', { success: false, message: 'Неверное имя или пароль' });
        }
    });

    socket.on('chatMessage', (data) => {
        const username = socketToUser.get(socket.id);
        const messageText = typeof data === 'string' ? data : data.text;
        const roomId = (data && data.roomId) || userRoom.get(username);
        
        if (username && roomId && messageText) {
            io.to(roomId).emit('chatMessage', {
                user: username,
                text: messageText
            });
            console.log(`[Чат в комнате ${roomId}] ${username}: ${messageText}`);
        }
    });

    socket.on('invite', ({ to, gameType }) => {
        const target = users.get(to);
        if (target && target.online && !target.inGame) {
            if (gameType === '3players') {
                if (!pending3Games.has(currentUser)) {
                    pending3Games.set(currentUser, { inviter: currentUser, invited: [to], gameType });
                    io.to(target.socketId).emit('inviteReceived', { from: currentUser, gameType, waitingForThird: true });
                    socket.emit('inviteSent', { to, waitingForThird: true });
                } else {
                    let pending = pending3Games.get(currentUser);
                    if (!pending.invited.includes(to)) {
                        pending.invited.push(to);
                        io.to(target.socketId).emit('inviteReceived', { from: currentUser, gameType, waitingForThird: true });
                        socket.emit('inviteSent', { to, waitingForThird: true });
                    }
                }
            } else {
                io.to(target.socketId).emit('inviteReceived', { from: currentUser, gameType });
                socket.emit('inviteSent', { to });
            }
        } else {
            socket.emit('inviteError', { message: 'Игрок недоступен' });
        }
    });

    socket.on('acceptInvite', ({ from, gameType }) => {
        const inviter = users.get(from);
        const acceptor = users.get(currentUser);
        
        if (!inviter || !inviter.online || !acceptor || !acceptor.online) {
            socket.emit('inviteError', { message: 'Ошибка приёма приглашения' });
            return;
        }
        
        if (gameType === '3players') {
            let pending = pending3Games.get(from);
            if (pending) {
                if (!pending.invited.includes(currentUser)) {
                    pending.invited.push(currentUser);
                }
                
                if (pending.invited.length >= 2) {
                    const players = [from, ...pending.invited.slice(0, 2)];
                    startGameRoom(players, gameType);
                    pending3Games.delete(from);
                } else {
                    socket.emit('waitingForThird', { message: 'Ожидание третьего игрока...' });
                    if (inviter.socketId) {
                        io.to(inviter.socketId).emit('waitingForThird', { message: 'Ожидание третьего игрока...' });
                    }
                }
            }
        } else {
            startGameRoom([from, currentUser], gameType);
        }
    });
    
    function startGameRoom(players, gameType) {
        const roomId = 'game_' + Date.now() + '_' + Math.random();
        const gameRoom = new GameRoom(roomId, players, gameType);
        gameRoom.startGame();
        activeGames.set(roomId, gameRoom);
        
        for (let p of players) {
            const user = users.get(p);
            if (user) {
                user.inGame = true;
                user.inGameRoom = roomId;
                userRoom.set(p, roomId);
                
                const playerSocket = io.sockets.sockets.get(user.socketId);
                if (playerSocket) {
                    playerSocket.join(roomId);
                    console.log(`[Socket] Игрок ${p} вошел в комнату ${roomId}`);
                }
                
                io.to(user.socketId).emit('gameStarted', {
                    roomId,
                    gameState: gameRoom.getGameState(),
                    playerHand: gameRoom.getPlayerHand(p)
                });
            }
        }
        updateOnlineList();
    }

    socket.on('playerAction', ({ roomId, action, data }) => {
        const gameRoom = activeGames.get(roomId);
        if (!gameRoom || !gameRoom.gameStarted) return;

        let result = false;
        
        if (action === 'attack') result = gameRoom.playerAttack(currentUser, data.cardId);
        else if (action === 'defend') result = gameRoom.playerDefend(currentUser, data.defendCardId);
        else if (action === 'add') result = gameRoom.playerAdd(currentUser, data.cardId);
        else if (action === 'take') result = gameRoom.playerTake(currentUser);
        else if (action === 'finishAdding') result = gameRoom.finishAdding();
        else if (action === 'nextTurn') result = gameRoom.nextTurn();

        if (result) {
            if (gameRoom.checkWinner()) {
                for (let player of gameRoom.players) {
                    const user = users.get(player.id);
                    if (user) {
                        user.inGame = false;
                        userRoom.delete(player.id);
                        io.to(user.socketId).emit('gameEnd', { 
                            results: gameRoom.results,
                            gameType: gameRoom.gameType
                        });
                    }
                }
                activeGames.delete(roomId);
                updateOnlineList();
            }
        }
    });

    function updateOnlineList() {
        const onlineUsers = [];
        for (let [name, data] of users) {
            if (data.online && !data.inGame) onlineUsers.push(name);
        }
        for (let [name, data] of users) {
            if (data.online) io.to(data.socketId).emit('onlineList', onlineUsers);
        }
    }

    socket.on('disconnect', () => {
        if (currentUser) {
            const user = users.get(currentUser);
            if (user) {
                user.online = false;
                userRoom.delete(currentUser);
                if (user.inGameRoom) {
                    const gameRoom = activeGames.get(user.inGameRoom);
                    if (gameRoom) {
                        for (let player of gameRoom.players) {
                            const puser = users.get(player.id);
                            if (puser && puser.online) {
                                io.to(puser.socketId).emit('gameEnd', { 
                                    results: [{ name: player.name, place: 3 }],
                                    gameType: gameRoom.gameType 
                                });
                                puser.inGame = false;
                                userRoom.delete(player.id);
                            }
                        }
                        activeGames.delete(user.inGameRoom);
                    }
                }
                updateOnlineList();
            }
        }
        socketToUser.delete(socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log('Сервер запущен на http://localhost:' + PORT);
    console.log('Игра СУЛТАН 90-х');
    console.log('Поддерживаются режимы: 2 игрока и 3 игрока');
    console.log('Козырь: БУБИ');
    console.log('Пики бьются только пиками');
    console.log('Дама заканчивает кон');
    console.log('Козырь бьёт ЛЮБУЮ карту другой масти (кроме пик)');
    console.log('Раздача: по 12 карт, добора карт НЕТ');
    console.log('Подкидывать можно любой номинал на столе');
    console.log('При взятии игрок забирает ВСЕ карты со стола');
    console.log('Победители НЕ участвуют в подкидывании');
    console.log('Покрылся - ходит отбившийся, взял - ходит следующий');
});
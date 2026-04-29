const socket = io();

let currentUser = null;
let currentRoomId = null;
let gameState = null;
let myHand = [];
let selectedOpponent = null;
let selectedOpponent2 = null;

const authScreen = document.getElementById('authScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameArea = document.getElementById('gameArea');
const registerBtn = document.getElementById('registerBtn');
const loginBtn = document.getElementById('loginBtn');
const regUsername = document.getElementById('regUsername');
const regPassword = document.getElementById('regPassword');
const authMessage = document.getElementById('authMessage');
const lobbyUsername = document.getElementById('lobbyUsername');
const onlineListDiv = document.getElementById('onlineList');
const invite2Btn = document.getElementById('invite2Btn');
const invite3Btn = document.getElementById('invite3Btn');
const passBtn = document.getElementById('passBtn');
const finishTurnBtn = document.getElementById('finishTurnBtn');
const turnIndicator = document.getElementById('turnIndicator');
const battleField = document.getElementById('battleField');
const trumpCardDiv = document.getElementById('trumpCard');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const playerCardsCount = document.getElementById('playerCardsCount');
const playerHandDiv = document.getElementById('playerHand');
const playerAvatar = document.getElementById('playerAvatar');
const winnerModal = document.getElementById('winnerModal');
const winnerText = document.getElementById('winnerText');
const playAgainBtn = document.getElementById('playAgainBtn');
const avatarTop = document.getElementById('avatarTop');
const nameTop = document.getElementById('nameTop');
const countTop = document.getElementById('countTop');
const handTop = document.getElementById('handTop');
const avatarTop2 = document.getElementById('avatarTop2');
const nameTop2 = document.getElementById('nameTop2');
const countTop2 = document.getElementById('countTop2');
const handTop2 = document.getElementById('handTop2');
const avatarRight = document.getElementById('avatarRight');
const nameRight = document.getElementById('nameRight');
const countRight = document.getElementById('countRight');
const handRight = document.getElementById('handRight');
const gameTable = document.querySelector('.game-table');
const currentPlayerNameSpan = document.getElementById('currentPlayerName');

// ========== ЧАТ ==========
const chatBtn = document.getElementById('chatBtn');
const chatWindow = document.getElementById('chatWindow');
const closeChatBtn = document.getElementById('closeChat');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const chatMessages = document.getElementById('chatMessages');
const chatBadge = document.getElementById('chatBadge');
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const emojiList = document.getElementById('emojiList');
const notificationArea = document.getElementById('notificationArea');

// Данные смайлов
const emojiData = {
    smiles: ['😊','😂','🤣','😍','😘','😒','😭','😎','😡','😱','😴','🤔','🙄','🤢','💀','🤡','😈','👿','🤖','💩'],
    gestures: ['👍','👎','👌','👊','👋','🤚','🖐️','🖖','🤘','🙏','🤝','💪','✍️','💅','👏','🙌','👐','🤲'],
    hearts: ['❤️','💔','🔥','✨','⭐','🌟','💫','💥','💦','💨','💯','🃏','🩸','⚰️','🏰','🦇','🥀','🍷','🗡️','⚔️','🛡️','🔮','💎','👑']
};

function filterEmoji(cat) {
    if (!emojiList) return;
    emojiList.innerHTML = '';
    if (emojiData[cat]) {
        emojiData[cat].forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-item';
            span.innerText = emoji;
            span.onclick = () => {
                if (chatInput) chatInput.value += emoji;
                if (emojiPicker) emojiPicker.style.display = 'none';
                if (chatInput) chatInput.focus();
            };
            emojiList.appendChild(span);
        });
    }
}

function addMessageToChat(userName, message) {
    if (!chatMessages) return;
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    const formattedText = message.replace(/\n/g, '<br>');
    msgEl.innerHTML = `<b>${userName}:</b> <span>${formattedText}</span>`;
    chatMessages.appendChild(msgEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showChatToast(userName, message) {
    if (!notificationArea) return;
    const toast = document.createElement('div');
    toast.className = 'chat-toast';
    const shortMsg = message.length > 30 ? message.substring(0, 30) + '...' : message;
    toast.innerHTML = `<b>${userName}:</b> ${shortMsg}`;
    notificationArea.appendChild(toast);
    setTimeout(() => {
        if (toast.remove) toast.remove();
    }, 4000);
}

function sendChatMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (text && currentUser && currentRoomId) {
        socket.emit('chatMessage', { text: text, roomId: currentRoomId });
        chatInput.value = '';
        if (emojiPicker) emojiPicker.style.display = 'none';
    }
}

function initChat() {
    if (chatBtn) {
        chatBtn.onclick = () => {
            if (chatWindow) chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
            if (chatBadge) chatBadge.style.display = 'none';
        };
    }
    if (closeChatBtn) closeChatBtn.onclick = () => { if (chatWindow) chatWindow.style.display = 'none'; };
    
    if (emojiBtn && emojiPicker) {
        emojiBtn.onclick = () => {
            if (emojiPicker.style.display === 'none') {
                filterEmoji('smiles');
                emojiPicker.style.display = 'flex';
            } else {
                emojiPicker.style.display = 'none';
            }
        };
    }
    
    if (sendChatBtn) sendChatBtn.onclick = sendChatMessage;
    if (chatInput) chatInput.onkeydown = (e) => { if (e.key === 'Enter') sendChatMessage(); };
}

function showPodium(results) {
    const modal = document.getElementById('podiumModal');
    const firstPlace = document.getElementById('firstPlaceName');
    const secondPlace = document.getElementById('secondPlaceName');
    const thirdPlace = document.getElementById('thirdPlaceName');
    const closeBtn = document.getElementById('closePodiumBtn');
    
    const first = results.find(r => r.place === 1);
    const second = results.find(r => r.place === 2);
    const third = results.find(r => r.place === 3);
    
    if (first) firstPlace.textContent = first.name;
    if (second) secondPlace.textContent = second.name;
    if (third) thirdPlace.textContent = third.name;
    
    modal.style.display = 'flex';
    
    startConfetti();
    
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
            lobbyScreen.style.display = 'flex';
            gameArea.style.display = 'none';
            stopConfetti();
        };
    }
}

function renderCard(card, isSelectable, actionType, isLadyHighlight = false) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card ' + card.suitEng;
    if (isLadyHighlight) cardDiv.style.boxShadow = '0 0 20px gold';
    const isRed = card.suit === '♥' || card.suit === '♦';
    const valueColor = isRed ? '#ff0000' : '#000000';
    cardDiv.innerHTML = '<div class="card-value" style="color: ' + valueColor + ';">' + card.name + '</div><div class="card-suit" style="color: ' + valueColor + ';">' + card.suit + '</div><div class="card-value" style="color: ' + valueColor + ';">' + card.name + '</div><div class="card-suit" style="color: ' + valueColor + ';">' + card.suit + '</div>';

    if (isSelectable && actionType) {
        cardDiv.style.cursor = 'pointer';
        cardDiv.onclick = (e) => {
            e.stopPropagation();
            if (!gameState || !gameState.gameStarted) return;
            const playerData = gameState.players.find(p => p.id === currentUser);
            if (playerData && !playerData.isActive) {
                console.log('Вы наблюдатель, не можете ходить');
                return;
            }
            if (actionType === 'attack') {
                socket.emit('playerAction', { roomId: currentRoomId, action: 'attack', data: { cardId: card.id } });
            } else if (actionType === 'defend') {
                socket.emit('playerAction', { roomId: currentRoomId, action: 'defend', data: { defendCardId: card.id } });
            } else if (actionType === 'add') {
                socket.emit('playerAction', { roomId: currentRoomId, action: 'add', data: { cardId: card.id } });
            }
        };
    }
    return cardDiv;
}

function renderPlayerHand() {
    playerHandDiv.innerHTML = '';
    
    const playerData = gameState?.players.find(p => p.id === currentUser);
    const isActive = playerData?.isActive !== false;
    const place = playerData?.place;
    const gameType = gameState?.gameType;
    
    if (!myHand || myHand.length === 0) {
        if (gameType === '3players') {
            if (place === 1) {
                playerHandDiv.innerHTML = '<div style="color: #ffd700; text-align: center; padding: 20px; font-size: 20px; text-shadow: 0 0 10px gold;">🏆 ВЫ ПОБЕДИТЕЛЬ! 1 МЕСТО 🏆</div>';
            } else if (place === 2) {
                playerHandDiv.innerHTML = '<div style="color: #c0c0c0; text-align: center; padding: 20px; font-size: 20px;">🥈 ВЫ ЗАНЯЛИ 2 МЕСТО 🥈</div>';
            } else if (place === 3) {
                playerHandDiv.innerHTML = '<div style="color: #cd7f32; text-align: center; padding: 20px; font-size: 20px;">🥉 ВЫ ЗАНЯЛИ 3 МЕСТО 🥉</div>';
            } else {
                playerHandDiv.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Нет карт</div>';
            }
        } else {
            playerHandDiv.innerHTML = '<div style="color: #666; text-align: center; padding: 20px;">Нет карт</div>';
        }
        return;
    }
    
    if (!isActive && place === 1 && gameType === '3players') {
        playerHandDiv.innerHTML = '<div style="color: #ffd700; text-align: center; padding: 20px; font-size: 20px; text-shadow: 0 0 10px gold;">👑 ВЫ ПОБЕДИТЕЛЬ! НАБЛЮДАЕТЕ ЗА ИГРОЙ 👑</div>';
        return;
    }
    
    const playerIndex = gameState ? gameState.players.findIndex(p => p.id === currentUser) : -1;
    let actionType = null;
    
    if (gameState && gameState.gameStarted && isActive) {
        if (gameState.phase === 'attacking' && gameState.currentAttacker === playerIndex) {
            actionType = 'attack';
        } else if (gameState.phase === 'defending' && gameState.currentDefender === playerIndex) {
            actionType = 'defend';
        } else if (gameState.phase === 'adding' && gameState.currentAttacker === playerIndex) {
            actionType = 'add';
        }
    }
    
    for (let card of myHand) {
        playerHandDiv.appendChild(renderCard(card, true, actionType));
    }
}

function updateGameUI(state) {
    gameState = state;
    if (!state.gameStarted) return;

    const players = state.players;
    const playerData = players.find(p => p.id === currentUser);
    const isActive = playerData?.isActive !== false;
    const playerIndex = players.findIndex(p => p.id === currentUser);
    const currentAttackerName = players[state.currentAttacker]?.name || 'Игрок';
    const currentDefenderName = players[state.currentDefender]?.name || 'Игрок';
    const gameType = state.gameType;
    
    if (currentPlayerNameSpan && currentUser) {
        currentPlayerNameSpan.textContent = currentUser;
    }
    
    if (gameTable) {
        if (gameType === '2players') {
            gameTable.classList.add('mode-2players');
            gameTable.classList.remove('mode-3players');
        } else {
            gameTable.classList.add('mode-3players');
            gameTable.classList.remove('mode-2players');
        }
    }

    playerNameDisplay.textContent = currentUser;
    
    if (gameType === '3players') {
        if (playerData?.place === 1 && !isActive) {
            playerCardsCount.innerHTML = '🏆 ЧЕМПИОН! 🏆';
        } else if (playerData?.place === 2 && !isActive) {
            playerCardsCount.innerHTML = '🥈 2 МЕСТО 🥈';
        } else if (playerData?.place === 3 && !isActive) {
            playerCardsCount.innerHTML = '🥉 3 МЕСТО 🥉';
        } else {
            playerCardsCount.textContent = 'Карт: ' + (players[playerIndex]?.handCount || 0);
        }
    } else {
        playerCardsCount.textContent = 'Карт: ' + (players[playerIndex]?.handCount || 0);
    }
    
    playerAvatar.innerHTML = '👤';
    avatarRight.innerHTML = '👤';
    nameRight.textContent = currentUser;
    
    if (gameType === '3players' && playerData?.place === 1 && !isActive) {
        countRight.innerHTML = '🏆 ЧЕМПИОН! 🏆';
    } else {
        countRight.textContent = 'Карт: ' + (players[playerIndex]?.handCount || 0);
    }
    
    handRight.innerHTML = '';
    if (isActive) {
        for (let j = 0; j < (players[playerIndex]?.handCount || 0); j++) {
            const backCard = document.createElement('div');
            backCard.className = 'card card-back';
            handRight.appendChild(backCard);
        }
    }

    let otherPlayers = [];
    for (let i = 0; i < players.length; i++) {
        if (players[i].id !== currentUser) {
            otherPlayers.push(players[i]);
        }
    }
    
    if (otherPlayers.length > 0) {
        avatarTop.innerHTML = '👤';
        nameTop.textContent = otherPlayers[0].name;
        if (gameType === '3players' && otherPlayers[0].place === 1 && !otherPlayers[0].isActive) {
            countTop.innerHTML = '🏆 ЧЕМПИОН! 🏆';
        } else {
            countTop.textContent = 'Карт: ' + otherPlayers[0].handCount;
        }
        handTop.innerHTML = '';
        if (otherPlayers[0].isActive) {
            for (let j = 0; j < otherPlayers[0].handCount; j++) {
                const backCard = document.createElement('div');
                backCard.className = 'card card-back';
                handTop.appendChild(backCard);
            }
        }
    }
    
    if (otherPlayers.length > 1 && gameType === '3players') {
        if (avatarTop2) {
            avatarTop2.style.display = 'flex';
            avatarTop2.innerHTML = '👤';
            nameTop2.textContent = otherPlayers[1].name;
            if (otherPlayers[1].place === 1 && !otherPlayers[1].isActive) {
                countTop2.innerHTML = '🏆 ЧЕМПИОН! 🏆';
            } else {
                countTop2.textContent = 'Карт: ' + otherPlayers[1].handCount;
            }
            handTop2.innerHTML = '';
            if (otherPlayers[1].isActive) {
                for (let j = 0; j < otherPlayers[1].handCount; j++) {
                    const backCard = document.createElement('div');
                    backCard.className = 'card card-back';
                    handTop2.appendChild(backCard);
                }
            }
        }
    } else if (avatarTop2) {
        avatarTop2.style.display = 'none';
    }

    if (state.trumpCard) trumpCardDiv.innerHTML = state.trumpCard.suit;

    battleField.innerHTML = '';
    if (state.attackCards && state.attackCards.length > 0) {
        for (let i = 0; i < state.attackCards.length; i++) {
            const attackDiv = renderCard(state.attackCards[i], false, null);
            attackDiv.style.border = '2px solid #ff0000';
            attackDiv.style.boxShadow = '0 0 15px red';
            battleField.appendChild(attackDiv);
            if (state.defendCards[i]) {
                const isLady = (state.defendCards[i].name === 'Д');
                const defendDiv = renderCard(state.defendCards[i], false, null, isLady);
                defendDiv.style.backgroundColor = '#dddddd';
                defendDiv.style.opacity = '0.9';
                battleField.appendChild(defendDiv);
            }
        }
    }

    const isMyAttack = (isActive && state.phase === 'attacking' && state.currentAttacker === playerIndex);
    const isMyDefend = (isActive && state.phase === 'defending' && state.currentDefender === playerIndex);
    const isMyAdd = (isActive && state.phase === 'adding' && state.currentAttacker === playerIndex);
    const isRoundFinished = (state.phase === 'finished');

    if (!isActive) {
        if (gameType === '3players' && playerData?.place === 1) {
            turnIndicator.innerHTML = '<span style="color: #ffd700; text-shadow: 0 0 10px gold;">👑 ВЫ ПОБЕДИТЕЛЬ! НАБЛЮДАЕТЕ ЗА ИГРОЙ 👑</span>';
        } else if (state.phase === 'attacking') {
            turnIndicator.innerHTML = '<span style="color: #ff6600;">⚔️ АТАКУЕТ: ' + currentAttackerName + ' ⚔️</span>';
        } else if (state.phase === 'defending') {
            turnIndicator.innerHTML = '<span style="color: #ff6600;">🛡️ ЗАЩИЩАЕТСЯ: ' + currentDefenderName + ' 🛡️</span>';
        } else if (state.phase === 'adding') {
            turnIndicator.innerHTML = '<span style="color: #ffaa00;">🎲 ПОДКИДЫВАНИЕ - ХОДИТ ' + currentAttackerName + ' 🎲</span>';
        } else {
            turnIndicator.innerHTML = '<span style="color: #888;">⏳ ОЖИДАНИЕ ХОДА ⏳</span>';
        }
        if (passBtn) passBtn.disabled = true;
        finishTurnBtn.disabled = true;
    } else if (isMyAttack) {
        turnIndicator.innerHTML = '<span style="color: #ff0000; text-shadow: 0 0 10px red;">⚔️ ВАША АТАКА - КИНЬТЕ ОДНУ КАРТУ ⚔️</span>';
        passBtn.disabled = true;
        finishTurnBtn.disabled = true;
        finishTurnBtn.innerHTML = 'ЗАКОНЧИТЬ ХОД';
    } else if (isMyDefend) {
        turnIndicator.innerHTML = '<span style="color: #ff6600; text-shadow: 0 0 10px orange;">🛡️ ВАША ЗАЩИТА - КИНЬТЕ КАРТУ ИЛИ ВОЗЬМИТЕ 🛡️</span>';
        passBtn.disabled = false;
        passBtn.style.opacity = '1';
        finishTurnBtn.disabled = true;
    } else if (isMyAdd) {
        turnIndicator.innerHTML = '<span style="color: #ffaa00; text-shadow: 0 0 10px orange;">🎲 ВАШЕ ПОДКИДЫВАНИЕ - КИНЬТЕ КАРТУ ТОГО ЖЕ НОМИНАЛА 🎲</span>';
        passBtn.disabled = true;
        finishTurnBtn.disabled = false;
        finishTurnBtn.innerHTML = 'ЗАКОНЧИТЬ ПОДКИДЫВАТЬ';
    } else if (isRoundFinished && isActive) {
        turnIndicator.innerHTML = '<span style="color: #00ff00; text-shadow: 0 0 10px green;">✅ ХОД ЗАВЕРШЁН - НАЖМИТЕ "ДАЛЕЕ" ✅</span>';
        passBtn.disabled = true;
        finishTurnBtn.disabled = false;
        finishTurnBtn.innerHTML = 'ДАЛЕЕ';
    } else if (isActive) {
        if (state.phase === 'attacking') {
            turnIndicator.innerHTML = '<span style="color: #ff6600;">⚔️ АТАКУЕТ: ' + currentAttackerName + ' ⚔️</span>';
        } else if (state.phase === 'defending') {
            turnIndicator.innerHTML = '<span style="color: #ff6600;">🛡️ ЗАЩИЩАЕТСЯ: ' + currentDefenderName + ' 🛡️</span>';
        } else if (state.phase === 'adding') {
            turnIndicator.innerHTML = '<span style="color: #ffaa00;">🎲 ПОДКИДЫВАНИЕ - ХОДИТ ' + currentAttackerName + ' 🎲</span>';
        } else {
            turnIndicator.innerHTML = '<span style="color: #888;">⏳ ОЖИДАНИЕ ⏳</span>';
        }
        passBtn.disabled = true;
        finishTurnBtn.disabled = true;
    }

    renderPlayerHand();
}

registerBtn.onclick = () => {
    const username = regUsername.value.trim();
    const password = regPassword.value.trim();
    if (!username || !password) { authMessage.style.display = 'block'; authMessage.innerHTML = 'Заполните поля'; return; }
    socket.emit('register', { username, password });
};

loginBtn.onclick = () => {
    const username = regUsername.value.trim();
    const password = regPassword.value.trim();
    if (!username || !password) { authMessage.style.display = 'block'; authMessage.innerHTML = 'Заполните поля'; return; }
    socket.emit('login', { username, password });
};

invite2Btn.onclick = () => {
    if (selectedOpponent) {
        socket.emit('invite', { to: selectedOpponent, gameType: '2players' });
        showNotification('Приглашение отправлено', 'Ожидайте ответа от ' + selectedOpponent);
    } else {
        alert('Выберите игрока из списка');
    }
};

invite3Btn.onclick = () => {
    if (selectedOpponent && selectedOpponent2) {
        socket.emit('invite', { to: selectedOpponent, gameType: '3players' });
        socket.emit('invite', { to: selectedOpponent2, gameType: '3players' });
        showNotification('Приглашения отправлены', 'Ожидайте ответа от ' + selectedOpponent + ' и ' + selectedOpponent2);
    } else {
        alert('Выберите ДВУХ игроков из списка для игры втроём');
    }
};

passBtn.onclick = () => {
    if (gameState && gameState.phase === 'defending' && gameState.currentDefender === gameState.players.findIndex(p => p.id === currentUser)) {
        if (confirm('Взять все карты со стола?')) {
            socket.emit('playerAction', { roomId: currentRoomId, action: 'take', data: {} });
        }
    }
};

finishTurnBtn.onclick = () => {
    if (!gameState) return;
    if (gameState.phase === 'adding') {
        socket.emit('playerAction', { roomId: currentRoomId, action: 'finishAdding', data: {} });
    } else if (gameState.phase === 'finished') {
        socket.emit('playerAction', { roomId: currentRoomId, action: 'nextTurn', data: {} });
    }
};

playAgainBtn.onclick = () => {
    winnerModal.style.display = 'none';
    lobbyScreen.style.display = 'flex';
    gameArea.style.display = 'none';
};

function showNotification(title, message, onAccept) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = '<strong>' + title + '</strong><br>' + message + '<br><button>ПРИНЯТЬ</button>';
    notification.querySelector('button').onclick = () => {
        notification.remove();
        if (onAccept) onAccept();
    };
    const area = document.getElementById('notificationArea');
    if (area) area.appendChild(notification);
    else document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 30000);
}

socket.on('registerResult', (data) => {
    authMessage.style.display = 'block';
    authMessage.innerHTML = data.message;
    if (data.success) {
        setTimeout(() => {
            authScreen.style.display = 'none';
            lobbyScreen.style.display = 'flex';
            lobbyUsername.textContent = regUsername.value;
            currentUser = regUsername.value;
            initChat();
        }, 1000);
    }
});

socket.on('loginResult', (data) => {
    authMessage.style.display = 'block';
    authMessage.innerHTML = data.message;
    if (data.success) {
        authScreen.style.display = 'none';
        lobbyScreen.style.display = 'flex';
        lobbyUsername.textContent = regUsername.value;
        currentUser = regUsername.value;
        initChat();
    }
});

socket.on('onlineList', (users) => {
    onlineListDiv.innerHTML = '';
    selectedOpponent = null;
    selectedOpponent2 = null;
    
    users.forEach(user => {
        const userDiv = document.createElement('div');
        userDiv.className = 'online-user';
        userDiv.textContent = user;
        userDiv.onclick = () => {
            if (userDiv.classList.contains('selected')) {
                userDiv.classList.remove('selected');
                if (selectedOpponent === user) selectedOpponent = null;
                if (selectedOpponent2 === user) selectedOpponent2 = null;
            } else if (!selectedOpponent) {
                document.querySelectorAll('.online-user').forEach(el => el.classList.remove('selected'));
                userDiv.classList.add('selected');
                selectedOpponent = user;
            } else if (!selectedOpponent2 && selectedOpponent !== user) {
                userDiv.classList.add('selected');
                selectedOpponent2 = user;
            }
        };
        onlineListDiv.appendChild(userDiv);
    });
});

socket.on('inviteReceived', (data) => {
    if (data.waitingForThird) {
        showNotification('Приглашение в игру втроём!', data.from + ' приглашает вас. Ожидание третьего игрока...', () => {
            socket.emit('acceptInvite', { from: data.from, gameType: data.gameType });
        });
    } else {
        showNotification('Приглашение в игру!', data.from + ' приглашает вас играть ' + (data.gameType === '2players' ? 'вдвоем' : 'втроем'), () => {
            socket.emit('acceptInvite', { from: data.from, gameType: data.gameType });
        });
    }
});

socket.on('gameStarted', (data) => {
    currentRoomId = data.roomId;
    gameState = data.gameState;
    myHand = data.playerHand;
    lobbyScreen.style.display = 'none';
    gameArea.style.display = 'flex';
    updateGameUI(gameState);
});

socket.on('gameState', (state) => {
    gameState = state;
    updateGameUI(state);
});

socket.on('playerHand', (hand) => {
    myHand = hand;
    renderPlayerHand();
});

socket.on('gameEnd', (data) => {
    if (data.gameType === '3players' && data.results && data.results.length === 3) {
        showPodium(data.results);
    } else if (data.gameType === '2players' && data.results && data.results.length === 2) {
        winnerModal.style.display = 'flex';
        const winner = data.results.find(r => r.place === 1);
        winnerText.innerHTML = '🏆 ПОБЕДИТЕЛЬ: ' + (winner?.name || 'Неизвестно') + ' 🏆';
        startConfetti();
        setTimeout(() => stopConfetti(), 10000);
    }
});

socket.on('chatMessage', (data) => {
    addMessageToChat(data.user, data.text);
    
    if (data.user !== currentUser && chatWindow && chatWindow.style.display !== 'flex' && chatBadge) {
        chatBadge.style.display = 'block';
        showChatToast(data.user, data.text);
    }
});

socket.on('inviteError', (data) => { alert(data.message); });
socket.on('waitingForThird', (data) => {
    const msgDiv = document.getElementById('waitingMessage');
    if (msgDiv) msgDiv.style.display = 'block';
    setTimeout(() => { if (msgDiv) msgDiv.style.display = 'none'; }, 5000);
});

console.log('Клиент загружен - Игра Султан 90-х');
window.filterEmoji = filterEmoji;

// ========== КОНФЕТТИ (ЗАМЕДЛЕННЫЕ) ==========
let confettiAnimationId = null;
let confettiCanvas = null;
let confettiCtx = null;
let confettiParticles = [];

function startConfetti() {
    if (confettiCanvas) {
        stopConfetti();
    }
    
    confettiCanvas = document.createElement('canvas');
    confettiCanvas.id = 'confettiCanvas';
    confettiCanvas.style.position = 'fixed';
    confettiCanvas.style.top = '0';
    confettiCanvas.style.left = '0';
    confettiCanvas.style.width = '100%';
    confettiCanvas.style.height = '100%';
    confettiCanvas.style.pointerEvents = 'none';
    confettiCanvas.style.zIndex = '1001';
    document.body.appendChild(confettiCanvas);
    
    confettiCtx = confettiCanvas.getContext('2d');
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    
    const colors = [
        '#ff0000', '#ff4d4d', '#ff6666', '#ff8888',
        '#ffd700', '#ffed4a', '#ffe66d', '#fff5aa',
        '#00ff00', '#4dff4d', '#66ff66', '#88ff88',
        '#ff00ff', '#ff4dff', '#ff66ff', '#ff88ff',
        '#00ffff', '#4dffff', '#66ffff', '#88ffff',
        '#ff6600', '#ff884d', '#ffaa66', '#ffcc88'
    ];
    
    confettiParticles = [];
    for(let i = 0; i < 200; i++) {
        confettiParticles.push({
            x: Math.random() * confettiCanvas.width,
            y: Math.random() * confettiCanvas.height - confettiCanvas.height,
            size: Math.random() * 8 + 4,
            width: Math.random() * 6 + 3,
            height: Math.random() * 6 + 3,
            speedX: (Math.random() - 0.5) * 2.5,
            speedY: Math.random() * 5 + 3,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: 1
        });
    }
    
    function animateConfetti() {
        if (!confettiCanvas || !confettiCtx) return;
        
        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        
        let allFinished = true;
        for(let i = 0; i < confettiParticles.length; i++) {
            const p = confettiParticles[i];
            p.x += p.speedX;
            p.y += p.speedY;
            p.rotation += p.rotationSpeed;
            p.opacity -= 0.0015;
            
            if(p.y < confettiCanvas.height + 100 && p.opacity > 0) {
                allFinished = false;
                confettiCtx.save();
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rotation * Math.PI / 180);
                confettiCtx.globalAlpha = p.opacity;
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.width/2, -p.height/2, p.width, p.height);
                confettiCtx.restore();
            }
        }
        
        if(allFinished) {
            stopConfetti();
        } else {
            confettiAnimationId = requestAnimationFrame(animateConfetti);
        }
    }
    
    animateConfetti();
    
    setTimeout(() => {
        stopConfetti();
    }, 10000);
}

function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    if (confettiCanvas) {
        confettiCanvas.remove();
        confettiCanvas = null;
    }
    confettiCtx = null;
    confettiParticles = [];
}

window.addEventListener('resize', () => {
    if (confettiCanvas) {
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }
});
var board = null;
var game = new Chess();
var stockfish = new Worker('js/stockfish.js');

function onDrop(source, target) {
    var move = game.move({
        from: source,
        to: target,
        promotion: 'q' // всегда превращать в ферзя для простоты
    });

    if (move === null) return 'snapback';

    // Сделать ход бота
    window.setTimeout(makeBotMove, 250);
}

function makeBotMove() {
    // Получить лучший ход от Stockfish
    stockfish.postMessage('position fen ' + game.fen());
    stockfish.postMessage('go depth 15');

    stockfish.onmessage = function(event) {
        var message = event.data;
        if (message.startsWith('bestmove')) {
            var bestMove = message.split(' ')[1];
            game.move(bestMove, { sloppy: true });
            board.position(game.fen());
        }
    };
}

var config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop
};

board = Chessboard('board', config);
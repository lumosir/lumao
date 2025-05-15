// 使用说明：
// 用 Ctrl+Shift+i 或 F12 打开chrome的dev tools
// 在console面板里粘贴以下代码，如果粘贴不上的，先在console面板下输入allow pasting，回车后再粘贴代码
// 三种扫雷模式都自动支持，省略了右键标记“雷”的动作

(async function miner(pick, counter) {
    function sleep(min = 500, max = 500) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(true);
            }, min + Math.floor(Math.abs(max - min) * Math.random()));
        });
    };

    const boardRows = document.querySelectorAll("div.gamecol");
    const cells = document.querySelectorAll("div.tile");
    const boardSize = cells.length;
    const rowCount = boardRows.length;
    const colCount = cells.length / boardRows.length;
    let board = {};
    let revealed = {};
    let cellPending = {};
    let unrevealed = {};
    let unrevealedCount = 0;
    for (let x = 0; x < rowCount; x++) {
        for (let y = 0; y < colCount; y++) {
            board[x] ??= {}, board[x][y] = cells[colCount * x + y];
            cellPending[x] ??= {}, cellPending[x][y] = cells[colCount * x + y];
            if (!cellPending[x][y].hasAttribute('style')) {
                unrevealed[x] ??= {}, unrevealed[x][y] = cells[colCount * x + y];
                unrevealedCount++;
            }
        }
    }

    let flaggedCells = new Set();
    function flagCell(x, y) {
        flaggedCells.add(`${x},${y}`)
    }

    async function analyzeBoard() {
        const lastUnrevealedCount = unrevealedCount;
        for (let x in cellPending) {
            for (let y in cellPending[x]) {
                x = parseInt(x), y = parseInt(y);
                const cell = cellPending[x][y];
                if (cell.hasAttribute('style')) {
                    let count = cell.textContent;
                    if (count === '') {
                        delete cellPending[x][y] && Object.keys(cellPending[x]) === 0 && delete cellPending[x];
                    } else {
                        count = parseInt(count);
                        if (typeof count === 'number' && count > 0) {
                            await checkSurroundings(x, y, count);
                        }
                    }
                }
            }
        }
        if (lastUnrevealedCount > unrevealedCount) {
            await analyzeBoard();
        }
    }

    async function checkSurroundings(x, y, count) {
        let mineCount = 0;
        let unrevealed_tmp = [];

        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const newX = x + i;
                const newY = y + j;
                if (newX >= 0 && newX < rowCount && newY >= 0 && newY < colCount) {
                    const cell = board[newX][newY];
                    if (flaggedCells.has(`${newX},${newY}`)) {
                        mineCount++;
                    } else if (unrevealed[newX]?.[newY]) {
                        if (unrevealed[newX]?.[newY].classList.contains('bomb')) {
                            throw { code: 0 };
                        }
                        if (unrevealed[newX]?.[newY].hasAttribute('style')) {
                            delete unrevealed[newX][newY] && (unrevealedCount--, Object.keys(unrevealed[newX]) === 0 && delete unrevealed[newX]);
                        } else {
                            unrevealed_tmp.push({ x: newX, y: newY });
                        }
                    }
                }
            }
        }
        if (mineCount === count) {
            let ok = true;
            for (let item of unrevealed_tmp) {
                const { x, y } = item;
                delete unrevealed[x][y] && (unrevealedCount--, Object.keys(unrevealed[x]) === 0 && delete unrevealed[x]);
                unrevealedCount--;
                board[x][y].click();
                ok &&= board[x][y].hasAttribute('style');
                await sleep(1000, 1500);
            }
            ok && delete cellPending[x][y] && Object.keys(cellPending[x]) === 0 && delete cellPending[x];
        } else if (mineCount + unrevealed_tmp.length === count) {
            unrevealed_tmp.forEach(({ x, y }) => flagCell(x, y));
            delete cellPending[x][y] && Object.keys(cellPending[x]) === 0 && delete cellPending[x];
        }

    }

    if (pick) {
        const _tmp = [];
        for (let x in unrevealed) {
            let item = unrevealed[x];
            for (let y in item) {
                _tmp.push({ x: parseInt(x), y: parseInt(y), cell: item[y] });
            }
        }
        const { x, y, cell } = _tmp[Math.floor(Math.random() * _tmp.length)];
        console.log(`随机开一个,坐标: ${x},${y}`);
        cell?.click();
        await sleep(1000, 1500);

        const isOver = document.querySelectorAll("div.tile")?.[colCount * x + y]?.classList.contains('bomb');
        if (isOver) {
            console.log(`本轮结束!`);
            return;
        }
        await miner(false, counter++);
    } else {
        try {
            await analyzeBoard();
        } catch (error) {
            console.log(`本轮结束!`);
            return;
        }
        if (unrevealedCount > 0) {
            await sleep(1000, 1500);
            await miner(true, counter);
        }
    }
})(false, 0);
(async function sweeper({ lastPendingCount, retry }) {
    // 使用说明：
    // 用 Ctrl+Shift+i 或 F12 打开chrome的dev tools
    // 在console面板里粘贴以下代码，如果粘贴不上的，先在console面板下输入allow pasting，回车后再粘贴代码
    // 三种扫雷模式都支持，先手动选择玩哪个难度，然后再运行代码
    function sleep(min = 1500, max = 2000) {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(true);
            }, min + Math.floor(Math.abs(max - min) * Math.random()));
        });
    };

    const boardRows = document.querySelectorAll("div.gamecol");
    const cells = document.querySelectorAll("div.tile");
    const boardSize = cells.length;
    const mineTotal = { 100: 10, 256: 35, 600: 99 }[boardSize];
    const rowCount = boardRows.length;
    const colCount = cells.length / boardRows.length;
    let board = {};
    let cellPending = {};
    let cellMineCount = {};
    let pending = {};
    let pendingCount = 0;
    for (let x = 0; x < rowCount; x++) {
        for (let y = 0; y < colCount; y++) {
            board[x] ??= {}, board[x][y] = cells[colCount * x + y];
            cellPending[x] ??= {}, cellPending[x][y] = cells[colCount * x + y];
            cellMineCount[x] ??= {};
            if (!cellPending[x][y].hasAttribute('style') && cellPending[x][y].textContent === '') {
                pending[x] ??= {}, pending[x][y] = cells[colCount * x + y];
                pendingCount++;
            }
            cellPending[x][y].classList.contains('tile-flagged') &&
                cellPending[x][y].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
        }
    }

    let flaggedCells = new Set();
    function flagCell(x, y) {
        flaggedCells.add(`${x},${y}`);
    }

    function removePending(x, y) {
        return delete pending[x][y] && (pendingCount--, Object.keys(pending[x]) === 0 && delete pending[x]), true;
    };

    function removeCellPending(x, y) {
        delete cellPending[x][y] && Object.keys(cellPending[x]) === 0 && delete cellPending[x];
    };

    async function analyzeBoard() {
        const lastPendingCount = pendingCount;
        for (let x in cellPending) {
            for (let y in cellPending[x]) {
                x = parseInt(x), y = parseInt(y);
                const cell = cellPending[x][y];
                let count = cell.textContent;
                if (cell.hasAttribute('style') || count !== '') {
                    if (count === '') {
                        removeCellPending(x, y);
                    } else {
                        count = parseInt(count);
                        if (typeof count === 'number' && count > 0) {
                            cellMineCount[x][y] = count;
                            await checkSurroundings(x, y, count);
                        }
                    }
                }
            }
        }
        if (lastPendingCount > pendingCount) {
            await analyzeBoard();
        } else {
            await filterHorizontal3();
            await filterVertical3();
            if (lastPendingCount > pendingCount) {
                await analyzeBoard();
            }
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
                    } else if (pending[newX]?.[newY]) {
                        if (pending[newX]?.[newY].classList.contains('bomb')) {
                            throw { code: 0, data: { x: newX, y: newY } };
                        }
                        if (pending[newX]?.[newY].hasAttribute('style')) {
                            removePending(newX, newY);
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
                removePending(x, y);
                board[x][y].click();
                // console.log(2, `document.querySelectorAll("div.tile")[${colCount * x + y}]`);
                await sleep();
                ok &&= board[x][y].hasAttribute('style');
            }
            ok && removeCellPending(x, y);
        } else if (mineCount + unrevealed_tmp.length === count) {
            try {
                unrevealed_tmp.forEach(({ x: _x, y: _y }) => {
                    flagCell(_x, _y);
                    removePending(_x, _y);
                    removeCellPending(_x, _y);
                    !board[_x][_y].classList.contains('tile-flagged') &&
                        board[_x][_y].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
                });
            } catch (error) {
                console.log(3, `document.querySelectorAll("div.tile")[${colCount * x + y}]`, unrevealed_tmp, error);
            }
            removeCellPending(x, y);
        } else {
            cellMineCount[x][y] = count - mineCount;
        }
    }

    function map2Array(obj) {
        const ret = [];
        for (let x in obj) {
            let item = obj[x];
            for (let y in item) {
                ret.push({ x: parseInt(x), y: parseInt(y), cell: item[y] });
            }
        }
        return ret;
    };

    async function clickPending(x, y) {
        if (!pending[x][y]) {
            return true;
        }
        return pending[x][y].click(), await sleep(),
            pending[x][y].hasAttribute('style') && removePending(x, y);
    };

    async function flagPending(x, y) {
        flagCell(x, y);
        removePending(x, y);
        removeCellPending(x, y);
        !board[x][y].classList.contains('tile-flagged') &&
            board[x][y].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
    };

    async function handleHorizontal3(r, c, side) {
        if (
            [c - 2, c - 1, c, c + 1, c + 2].every(e => !pending[r + side]?.[e])
            && [c - 1, c, c + 1].some(e => pending[r - side]?.[e])
            && [c - 2, c + 2].every(e => !pending[r - side]?.[e])
        ) {
            console.log('handleHorizontal3', `document.querySelectorAll("div.tile")[${colCount * r + c}] ${cellMineCount[r][c]}`);
            // throw { code: 0, msg: `document.querySelectorAll("div.tile")[${colCount * r + c}] ${cellMineCount[r][c]}` };
            if (cellMineCount[r][c] === 1) {
                await flagPending(r - side, c), await clickPending(r - side, c - 1), await clickPending(r - side, c + 1);
                return true;
            } else if (cellMineCount[r][c] === 2) {
                await clickPending(r - side, c), await flagPending(r - side, c - 1), await flagPending(r - side, c + 1);
                return true;
            }
        }
        return false;
    };

    async function handleVertical3(c, r, side) {
        if (
            [r - 2, r - 1, r, r + 1, r + 2].every(e => !pending[e]?.[c + side])
            && [r - 1, r, r + 1].some(e => pending[e]?.[c - side])
            && [r - 2, r + 2].every(e => !pending[e]?.[c - side])
        ) {
            console.log('handleVertical3', `document.querySelectorAll("div.tile")[${colCount * r + c}]`, cellMineCount[r][c]);
            // throw { code: 0, msg: `document.querySelectorAll("div.tile")[${colCount * r + c}] ${cellMineCount[r][c]}` };
            if (cellMineCount[r][c] === 1) {
                await flagPending(r, c - side), await clickPending(r - 1, c - side), await clickPending(r + 1, c - side);
                return true;
            } else if (cellMineCount[r][c] === 2) {
                await clickPending(r, c - side), await flagPending(r - 1, c - side), await flagPending(r + 1, c - side);
                return true;
            }
        }
        return false;
    };

    async function filterHorizontal3() {
        for (let r in cellMineCount) {
            let item = cellMineCount[r];
            r = parseInt(r);
            if (Object.keys(item).length >= 3) {
                for (let c in item) {
                    c = parseInt(c);
                    if (
                        (item[c] === 1 || item[c] === 2) && item[c - 1] === 1 && item[c + 1] === 1
                        && !pending[r]?.[c - 2] && !pending[r]?.[c + 2]
                    ) {
                        if (await handleHorizontal3(r, c, 1) || await handleHorizontal3(r, c, -1)) {
                            return await filterHorizontal3();
                        }
                    }
                }
            }
        }
    };

    async function filterVertical3() {
        const _cellMineCount = {};
        for (let r in cellMineCount) {
            let item = cellMineCount[r];
            r = parseInt(r);
            for (let c in item) {
                c = parseInt(c);
                _cellMineCount[c] ??= {}, _cellMineCount[c][r] = item[c];
            }
        }

        for (let c in _cellMineCount) {
            let item = _cellMineCount[c];
            c = parseInt(c);
            if (Object.keys(item).length >= 3) {
                for (let r in item) {
                    r = parseInt(r);
                    if (
                        (item[r] === 1 || item[r] === 2) && item[r - 1] === 1 && item[r + 1] === 1
                        && !pending[r - 2]?.[c] && !pending[r + 2]?.[c]
                    ) {
                        if (await handleVertical3(c, r, 1) || await handleVertical3(c, r, -1)) {
                            return await filterVertical3();
                        }
                    }
                }
            }
        }
    };

    async function tryCheckLastMine() {
        let ret = -1;
        const pendingArr = map2Array(pending);
        const cellPendingArr = map2Array(cellPending);
        const bingo = pendingArr.find(
            ({ x, y, cell }) => cellPendingArr.every(
                ({ x: _x, y: _y, cell: _cell }) => _x - 1 <= x && x <= _x + 1 && _y - 1 <= y && y <= _y + 1
            )
        );
        if (bingo) {
            const { x, y, cell } = bingo;
            for (let { x: _x, y: _y, cell: _cell } of pendingArr) {
                if (x === _x && y === _y) {
                    ret = 0;
                    !_cell.classList.contains('tile-flagged') &&
                        _cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }));
                } else {
                    // _cell.click(), await sleep();
                    await clickPending(_x, _y);
                }
            }
        } else {
            for (let { x, y, cell } of pendingArr) {
                for ({ x: _x, y: _y, cell: _cell } of cellPendingArr) {
                    if (!(_x - 1 <= x && x <= _x + 1 && _y - 1 <= y && y <= _y + 1)) {
                        ret = 1;
                        await clickPending(x, y);
                    }
                }
            }
            if (ret === 1) {
                await analyzeBoard();
                return await tryCheckLastMine();
            }
        }
        return ret;
    };

    if (boardSize > 0) {
        try {
            await analyzeBoard();
        } catch (error) {
            if (error.data) {
                const { x, y } = error.data;
                console.log(`本轮结束!`, x, y);
                return 0;
            }
            console.log(error);
            if (error.code === 0) {
                return error;
            }
            return -1;
        }
        if (pendingCount > 0 && lastPendingCount === pendingCount) {
            retry++;
            if (retry > 10) {
                if (boardSize === pendingCount) {
                    console.log(`今日可能已完成3次游戏,等下一个(UTC+8)12点重置!`);
                } else {
                    console.log(`ip可能被限制,结束!`);
                }
                return pendingCount;
            }
        }

        if (mineTotal - flaggedCells.size === 1) {
            if (await tryCheckLastMine() === 0) {
                console.log(`本轮结束!`);
                return 0;
            }
        }
        const _tmp = map2Array(pending);
        if (_tmp.length > 0) {
            const { x, y, cell } = _tmp[Math.floor(Math.random() * _tmp.length)];
            console.log(`随机开一个,坐标: ${x},${y}`);
            console.log(1, `document.querySelectorAll("div.tile")[${colCount * x + y}]`);
            cell?.click();
            lastPendingCount === undefined ? await sleep(3000, 5000) : await sleep();

            const isOver = document.querySelectorAll("div.tile")?.[colCount * x + y]?.classList.contains('bomb');
            if (isOver) {
                console.log(`本轮结束!`);
                return -1;
            }
        }
        return await sweeper({ lastPendingCount: pendingCount, retry });
    } else {
        return await sweeper({ retry });
    }
})({ retry: 0 });
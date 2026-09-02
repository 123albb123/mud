export const createTerminalFixture = (lineCount: number): string => {
    const lines = Array.from({ length: lineCount }, (_, index) => {
        const line = index % 5 === 0
            ? `战斗回合 ${index}：你挥动长剑，命中江湖 NPC。`
            : index % 5 === 1
                ? `短行 ${index}`
                : index % 5 === 2
                    ? `\u001b[31m伤害 ${index}\u001b[0m：气血下降。`
                    : index % 5 === 3
                        ? `\u001b[38;5;45m多彩消息 ${index}\u001b[0m：中文 UTF-8。`
                        : `长行 ${index}：${'江湖文字 '.repeat(40)}`;
        return line;
    });
    return lines.join('\n');
};

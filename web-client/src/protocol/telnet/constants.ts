export const Telnet = {
    IAC: 255,
    DONT: 254,
    DO: 253,
    WONT: 252,
    WILL: 251,
    SB: 250,
    SE: 240,
    ECHO: 1,
    SUPPRESS_GO_AHEAD: 3,
    TERMINAL_TYPE: 24,
    NAWS: 31,
    NEW_ENVIRON: 39,
    CHARSET: 42,
    MSSP: 70,
    MSP: 90,
    GMCP: 201,
} as const;

export const telnetCommandName = (command: number): string => ({
    [Telnet.WILL]: 'WILL',
    [Telnet.WONT]: 'WONT',
    [Telnet.DO]: 'DO',
    [Telnet.DONT]: 'DONT',
    [Telnet.SB]: 'SB',
    [Telnet.SE]: 'SE',
}[command] ?? `COMMAND_${command}`);

export const telnetOptionName = (option: number): string => ({
    [Telnet.ECHO]: 'ECHO',
    [Telnet.SUPPRESS_GO_AHEAD]: 'SUPPRESS_GO_AHEAD',
    [Telnet.TERMINAL_TYPE]: 'TERMINAL_TYPE',
    [Telnet.NAWS]: 'NAWS',
    [Telnet.NEW_ENVIRON]: 'NEW_ENVIRON',
    [Telnet.CHARSET]: 'CHARSET',
    [Telnet.MSSP]: 'MSSP',
    [Telnet.MSP]: 'MSP',
    [Telnet.GMCP]: 'GMCP',
}[option] ?? `OPTION_${option}`);

export type GameMode = "pvp" | "pve-easy" | "pve-medium" | "pve-hard";

interface GameModeSelectorProps {
  onSelectMode: (mode: GameMode) => void;
  onStartFriendPlay: () => void;
}

const modes: Array<{ id: GameMode; title: string; description: string }> = [
  { id: "pvp", title: "双人对战", description: "两人在同一设备轮流行棋" },
  { id: "pve-easy", title: "人机简单", description: "AI 计算2步后的攻防" },
  { id: "pve-medium", title: "人机中等", description: "AI 计算6步后的攻防" },
  { id: "pve-hard", title: "人机困难", description: "AI 计算9步后的攻防" },
];

export default function GameModeSelector({ onSelectMode, onStartFriendPlay }: GameModeSelectorProps) {
  return (
    <div className="modal-backdrop">
      <section className="mode-dialog" aria-label="选择游戏模式">
        <h2>选择模式</h2>
        <div className="mode-grid">
          {modes.map((mode) => (
            <button key={mode.id} className="mode-button" onClick={() => onSelectMode(mode.id)}>
              <strong>{mode.title}</strong>
              <span>{mode.description}</span>
            </button>
          ))}
        </div>
        <div className="mode-footer">
          <button className="mode-button friend-button" onClick={onStartFriendPlay}>
            <strong>与好友一起玩</strong>
            <span>生成房间链接，好友点击后即可进入同一房间</span>
          </button>
        </div>
      </section>
    </div>
  );
}

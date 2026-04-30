import { useState, useEffect } from "react";
import { BookOpen, X, ChevronRight, FolderOpen, Search, LayoutGrid } from "lucide-react";
import { markTutorialAsSeen } from "../utils/tutorialStorage";

interface TutorialDialogProps {
  onClose: () => void;
}

const tutorialSteps = [
  {
    icon: FolderOpen,
    title: "获取数据",
    description: "你可以浏览原版游戏Jar文件，数据在“data/minecraft/命名空间下。这时你可以看见”loot_tables“文件夹。同理，整合包的数据也在特定的专属Mod内可以找到。",
  },
];

export function TutorialDialog({ onClose }: TutorialDialogProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  const handleConfirm = () => {
    markTutorialAsSeen();
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleConfirm} />

      <div
        className={`relative w-full max-w-lg bg-white rounded-[36px] shadow-2xl overflow-hidden transform transition-all duration-500 ${
          isVisible ? "scale-100 translate-y-0" : "scale-95 translate-y-4"
        }`}
      >
        <div className="absolute top-6 right-6">
          <button
            onClick={handleConfirm}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="p-10">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-14 w-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-[24px] flex items-center justify-center shadow-lg shadow-blue-500/25">
              <BookOpen className="h-7 w-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800">使用教程</h2>
            </div>
          </div>

          <div className="space-y-6">
            {tutorialSteps.map((step, index) => (
              <div key={index} className="flex gap-5">
                <div className="shrink-0">
                  <div className="h-10 w-10 bg-slate-50 rounded-[16px] flex items-center justify-center">
                    <step.icon className="h-5 w-5 text-blue-500" />
                  </div>
                </div>
                <div className="flex-1 pt-1">
                  <h3 className="text-sm font-bold text-slate-800 mb-1">{step.title}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.description}</p>
                </div>
                {index < tutorialSteps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-slate-200 shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="px-10 pb-10">
          <button
            onClick={handleConfirm}
            className="w-full h-14 bg-slate-900 hover:bg-slate-800 rounded-[24px] text-white font-bold text-sm tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-slate-900/20"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}

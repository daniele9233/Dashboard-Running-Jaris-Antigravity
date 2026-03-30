import { TrainingGrid } from "./TrainingGrid";
import { TrainingSidebar } from "./TrainingSidebar";

export function TrainingView() {
  return (
    <div className="flex-1 flex overflow-hidden bg-[#121212] text-white">
      {/* Main Grid Area */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-[#2A2A2A]">
        <TrainingGrid />
      </div>
      
      {/* Right Sidebar */}
      <div className="w-[350px] flex-shrink-0 overflow-y-auto bg-[#181818]">
        <TrainingSidebar />
      </div>
    </div>
  );
}

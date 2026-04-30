﻿import { useState } from "react";
import { MainContent } from "./components/MainContent";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { TutorialDialog } from "./components/TutorialDialog";
import { shouldShowTutorial } from "./utils/tutorialStorage";
import { useLootExplorer } from "./hooks/useLootExplorer";

const App = () => {
  const [showTutorial, setShowTutorial] = useState(() => shouldShowTutorial());

  const {
    rootData,
    itemRegistry,
    iconRegistry,
    setIconRegistry,
    isParsing,
    currentPath,
    setCurrentPath,
    searchQuery,
    isInputGlobalSearch,
    showSearchDropdown,
    setShowSearchDropdown,
    isListView,
    filteredDisplayData,
    searchSuggestions,
    handleFileChange,
    handleBack,
    handleSearchChange,
    handleSelectItem,
    navigateTo,
    setPathSearchQueries,
  } = useLootExplorer();

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4 md:p-10 font-sans text-slate-900 overflow-hidden">
      {showTutorial && <TutorialDialog onClose={() => setShowTutorial(false)} />}

      <div className="w-full max-w-7xl h-full bg-white rounded-[40px] border border-slate-200 shadow-2xl flex overflow-hidden">
        <Sidebar
          rootData={rootData}
          currentPath={currentPath}
          onSelectRoot={(key) => {
            setPathSearchQueries({});
            setCurrentPath([key]);
          }}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar
            hasData={Boolean(rootData)}
            currentPath={currentPath}
            searchQuery={searchQuery}
            isInputGlobalSearch={isInputGlobalSearch}
            isListView={isListView}
            showSearchDropdown={showSearchDropdown}
            setShowSearchDropdown={setShowSearchDropdown}
            searchSuggestions={searchSuggestions}
            itemRegistry={itemRegistry}
            onBack={handleBack}
            onGoRoot={() => setCurrentPath([])}
            onSearchChange={handleSearchChange}
            onSelectSuggestion={handleSelectItem}
          />

          <MainContent
            rootDataReady={Boolean(rootData)}
            isParsing={isParsing}
            currentPath={currentPath}
            isListView={isListView}
            filteredDisplayData={filteredDisplayData}
            iconRegistry={iconRegistry}
            setIconRegistry={setIconRegistry}
            onOpenNode={(name) => navigateTo([...currentPath, name])}
            onUploadFiles={handleFileChange}
          />
        </div>
      </div>

      <style>{`
        @keyframes progress { 0% { width: 0; transform: translateX(-20%); } 50% { width: 50%; } 100% { width: 0; transform: translateX(280%); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #f1f5f9; border-radius: 10px; }
        .overflow-wrap-anywhere { overflow-wrap: anywhere; }
      `}</style>
    </div>
  );
};

export default App;

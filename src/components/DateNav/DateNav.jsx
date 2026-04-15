// DateNav component - Date navigation (previous/next day)
import useAppStore from '../../store/useAppStore.js';
import { formatDisplayDate, addDays } from '../../utils/dateUtils.js';

export default function DateNav() {
  const { selectedDate, setSelectedDate, fetchMatches } = useAppStore();
  
  const handlePrevDay = () => {
    const newDate = addDays(selectedDate, -1);
    setSelectedDate(newDate);
    // Trigger fetch for new date
    setTimeout(() => fetchMatches(), 0);
  };
  
  const handleNextDay = () => {
    const newDate = addDays(selectedDate, 1);
    setSelectedDate(newDate);
    // Trigger fetch for new date
    setTimeout(() => fetchMatches(), 0);
  };
  
  return (
    <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-3">
      <button
        onClick={handlePrevDay}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Día anterior"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <div className="text-center">
        <span className="font-semibold text-gray-800">
          {formatDisplayDate(selectedDate)}
        </span>
      </div>
      
      <button
        onClick={handleNextDay}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Día siguiente"
      >
        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
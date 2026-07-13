import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  FileText, 
  MoreVertical, 
  Plus, 
  Lock, 
  Eye, 
  Heart, 
  MessageSquare,
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  Download,
  FileDown,
  Columns,
  Filter,
  Printer,
  Trash2,
  Unlock,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/Table';

const STATIC_DOCTYPES = [
  { id: '1', name: 'Language', module: 'System', slug: 'language', isLocked: true, isPrintable: true },
  { id: '2', name: 'Menu', module: 'System', slug: 'menu', isLocked: false, isPrintable: false },
  { id: '3', name: 'Module', module: 'System', slug: 'module', isLocked: true, isPrintable: false },
  { id: '4', name: 'Role', module: 'Settings', slug: 'role', isLocked: false, isPrintable: false },
  { id: '5', name: 'Role Menu', module: 'Settings', slug: 'role-menu', isLocked: true, isPrintable: true },
  { id: '6', name: 'Translate', module: 'System', slug: 'translate', isLocked: true, isPrintable: false },
  { id: '7', name: 'User', module: 'Settings', slug: 'user', isLocked: false, isPrintable: false },
  { id: '8', name: 'User Role', module: 'Settings', slug: 'user-role', isLocked: true, isPrintable: false },
  { id: '9', name: 'Welcome', module: 'Dashboard', slug: 'welcome', isLocked: true, isPrintable: true },
];

const ACTIVITIES = [
  { id: 1, user: 'Sutikno Sofjan', initial: 'S', target: 'ID 204 (Translation)', action: 'Deleted', color: 'text-red-500', time: 'Jul 12 2026, 05:52' },
  { id: 2, user: 'Sutikno Sofjan', initial: 'S', target: 'ID 313 (Translate)', action: 'Created', color: 'text-green-500', time: 'Jul 12 2026, 05:27' },
  { id: 3, user: 'Sutikno Sofjan', initial: 'S', target: 'ID 204 (Translation)', action: 'Unlocked', color: 'text-purple-500', time: 'Jul 12 2026, 05:21' },
  { id: 4, user: 'Sutikno Sofjan', initial: 'S', target: 'ID 312 (Translate)', action: 'Created', color: 'text-green-500', time: 'Jul 12 2026, 05:02' },
  { id: 5, user: 'Sutikno Sofjan', initial: 'S', target: 'ID 203 (Language)', action: 'Locked', color: 'text-green-500', time: 'Jul 12 2026, 03:50' },
];

export default function Home() {
  const [selectedRows, setSelectedRows] = useState([]);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [doctypes, setDoctypes] = useState(STATIC_DOCTYPES);
  const router = useRouter(); // To ensure we can use router if not imported
  
  const moreMenuRef = useRef(null);
  const bulkMenuRef = useRef(null);

  useEffect(() => {
    import('@/lib/doc-api').then(({ docApi }) => {
      docApi.getList('sys_doctype').then(res => {
        if (res.success && res.data && res.data.length > 0) {
          setDoctypes(res.data);
        }
      }).catch(err => console.log('Using static doctypes, error fetching:', err.message));
    });
  }, []);

  // Handle outside click for menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreMenuOpen(false);
      }
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(event.target)) {
        setIsBulkMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedRows(doctypes.map(d => d.id));
    } else {
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (e, id) => {
    e.stopPropagation();
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter(r => r !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  const isAllSelected = selectedRows.length === doctypes.length && doctypes.length > 0;
  const hasSelection = selectedRows.length > 0;

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="text-blue-600 dark:text-blue-500">
            <FileText className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Doctype</h1>
        </div>
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center gap-2">
          <FileText className="h-4 w-4" /> / System / <span className="text-slate-900 dark:text-slate-100">Doctype</span>
        </div>
      </div>

      {/* Main Table Card */}
      <Card>
        <div className="p-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 gap-4 overflow-x-auto">
          <div className="flex items-center gap-3">
            <Input type="text" placeholder="Filter Name..." className="h-9 w-40 shrink-0" />
            <select className="h-9 w-40 shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <option value="">All Modules</option>
              <option value="System">System</option>
              <option value="Settings">Settings</option>
              <option value="Dashboard">Dashboard</option>
            </select>
            <Input type="text" placeholder="Filter Slug..." className="h-9 w-40 shrink-0" />
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            
            {/* Bulk Action */}
            {hasSelection && (
              <div className="relative" ref={bulkMenuRef}>
                <Button 
                  variant="outline" 
                  title="Bulk Actions"
                  className="h-9 gap-2 text-slate-600 dark:text-slate-300"
                  onClick={() => setIsBulkMenuOpen(!isBulkMenuOpen)}
                >
                  Bulk Action <ChevronDown className="h-4 w-4" />
                </Button>
                
                {isBulkMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-900 dark:ring-slate-800 border border-slate-200 dark:border-slate-800 z-10">
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                      <Printer className="h-4 w-4 text-slate-400" /> Print Selected
                    </button>
                    <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800">
                      <Trash2 className="h-4 w-4 text-red-500" /> Delete Selected
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* More Menu */}
            <div className="relative" ref={moreMenuRef}>
              <Button 
                variant="outline" 
                size="icon" 
                title="More Actions"
                className="h-9 w-9 text-slate-600 dark:text-slate-300"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
              
              {isMoreMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none dark:bg-slate-900 dark:ring-slate-800 border border-slate-200 dark:border-slate-800 z-10">
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Upload className="h-4 w-4 text-slate-400" /> Import .csv
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Download className="h-4 w-4 text-slate-400" /> Export .xlsx
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <FileDown className="h-4 w-4 text-slate-400" /> Export .pdf
                  </button>
                  <div className="h-px bg-slate-200 dark:bg-slate-800 my-1"></div>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Columns className="h-4 w-4 text-slate-400" /> Fields View
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                    <Filter className="h-4 w-4 text-slate-400" /> Fields Filter
                  </button>
                </div>
              )}
            </div>

            <Button size="icon" title="Add New" className="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 dark:border-slate-800">
              <TableHead className="w-12 text-center">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 w-3.5 h-3.5 cursor-pointer" 
                  checked={isAllSelected}
                  onChange={handleSelectAll}
                />
              </TableHead>
              <TableHead className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-2">
                <ArrowDownIcon className="h-3 w-3" /> NAME
              </TableHead>
              <TableHead className="font-semibold text-slate-500 dark:text-slate-400">
                MODULE
              </TableHead>
              <TableHead className="font-semibold text-slate-500 dark:text-slate-400">
                SLUG
              </TableHead>
              <TableHead className="text-left w-48">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctypes.map((doc) => {
              const docId = doc.id || doc.name;
              const isSelected = selectedRows.includes(docId);
              
              return (
                <TableRow key={docId} className="border-slate-200 dark:border-slate-800" data-state={isSelected ? "selected" : undefined}>
                  <TableCell className="text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 w-3.5 h-3.5 cursor-pointer" 
                      checked={isSelected}
                      onChange={() => handleSelectRow(docId)}
                    />
                  </TableCell>
                  <TableCell className="font-bold">
                    <span 
                      className="cursor-pointer text-blue-600 hover:underline"
                      onClick={() => router.push(`/${doc.module.toLowerCase()}/${doc.slug || doc.name.toLowerCase()}`)}
                    >
                      {doc.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-600 dark:text-slate-400">{doc.module}</TableCell>
                  <TableCell className="font-bold text-slate-600 dark:text-slate-400">{doc.slug || doc.name}</TableCell>
                  <TableCell className="text-left w-48">
                    <div className="flex items-center justify-start gap-4 text-slate-400">
                      <span title="Likes (Total)" className="flex items-center text-xs gap-1 cursor-default">
                        <Heart className="h-3 w-3 text-pink-500" /> 0
                      </span>
                      <span title="Comments (Total)" className="flex items-center text-xs gap-1 cursor-default mr-3">
                        <MessageSquare className="h-3 w-3 text-blue-400" /> 0
                      </span>
                      
                      {doc.isLocked ? (
                        <>
                          <Lock title="Locked" className="h-4 w-4 text-green-500 cursor-pointer" />
                          <Eye title="View Details" className="h-4 w-4 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300" />
                          {doc.isPrintable && (
                            <Printer title="Print" className="h-4 w-4 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300" />
                          )}
                        </>
                      ) : (
                        <>
                          <Unlock title="Unlocked" className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-600" />
                          <Edit title="Edit" className="h-4 w-4 text-blue-500 cursor-pointer hover:text-blue-600" />
                          <Trash2 title="Delete" className="h-4 w-4 text-red-500 cursor-pointer hover:text-red-600" />
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="p-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 rounded-b-lg">
          <div className="flex items-center gap-4">
            <div title="Rows per page" className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-md px-2 py-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
              10 <ChevronDown className="h-4 w-4" />
            </div>
            <span>Showing {doctypes.length} of {doctypes.length} rows</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Showing 1 of 1 pages</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" title="Previous Page" className="h-7 w-7 opacity-50 bg-white dark:bg-slate-900" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" title="Next Page" className="h-7 w-7 opacity-50 bg-white dark:bg-slate-900" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Activity Timeline Card */}
      <Card>
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-500" /> Activity Timeline
        </div>
        <div className="p-0">
          {ACTIVITIES.map((activity, idx) => (
            <div 
              key={activity.id} 
              className={cn(
                "flex items-center justify-between px-4 py-[11px]",
                idx !== ACTIVITIES.length - 1 && "border-b border-slate-100 dark:border-slate-800/50"
              )}
            >
              <div className="flex items-center gap-3">
                <div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold dark:bg-blue-900/30 dark:text-blue-400">
                  {activity.initial}
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{activity.user}</span>
                  <span className="text-slate-500 dark:text-slate-400">, {activity.target} </span>
                  <span className={cn("font-medium", activity.color)}>{activity.action}</span>
                </div>
              </div>
              <div className="text-xs text-slate-400">
                {activity.time}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Arrow icon for sorting header
function ArrowDownIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

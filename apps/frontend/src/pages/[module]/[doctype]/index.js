import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Columns, 
  Download, 
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit
} from 'lucide-react';
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
import { docApi } from '@/lib/doc-api';

export default function DynamicList() {
  const router = useRouter();
  const { module, doctype } = router.query;
  
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Format the doctype slug for display (e.g. "sys_user" -> "Sys User")
  const formattedTitle = doctype 
    ? doctype.toString().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Loading...';

  const fetchData = async () => {
    if (!doctype) return;
    
    setIsLoading(true);
    setError(null);
    try {
      // In a real app, we'd also get the metadata for this doctype to know which columns to show
      // For now, we'll fetch the data and use the keys of the first item as columns
      const res = await docApi.getList(doctype);
      if (res.success) {
        setData(res.data || []);
      } else {
        throw new Error('Failed to fetch data');
      }
    } catch (err) {
      console.error('Error fetching list:', err);
      setError(err.response?.data?.error || err.message || 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [doctype]);

  // Derive columns from the first data item, or default to some basics
  const columns = data.length > 0 
    ? Object.keys(data[0]).filter(k => !['tenant_id', 'password', 'pin'].includes(k)).slice(0, 6)
    : ['id', 'name', 'status', 'created_at'];

  return (
    <>
      <Head>
        <title>{formattedTitle} List | Framee</title>
      </Head>

      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600 dark:bg-blue-900/30 dark:text-blue-500">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {formattedTitle}
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Manage {formattedTitle} records
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => fetchData()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={() => router.push(`/${module}/${doctype}/new`)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New {formattedTitle}
            </Button>
          </div>
        </div>

        {/* Filters and Actions Bar */}
        <Card className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name or ID..." 
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="icon" className="shrink-0">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0">
              <Columns className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="shrink-0">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Data Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  {columns.map(col => (
                    <TableHead key={col} className="capitalize">
                      {col.replace(/_/g, ' ')}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="h-32 text-center">
                      <RefreshCw className="h-6 w-6 animate-spin mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-500">Loading records...</p>
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="h-32 text-center">
                      <p className="text-sm text-red-500">{error}</p>
                    </TableCell>
                  </TableRow>
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 2} className="h-32 text-center">
                      <p className="text-sm text-slate-500">No records found.</p>
                      <Button 
                        variant="link" 
                        onClick={() => router.push(`/${module}/${doctype}/new`)}
                        className="mt-2"
                      >
                        Create your first {formattedTitle}
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, idx) => (
                    <TableRow key={row.id || idx}>
                      <TableCell>
                        <input type="checkbox" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      </TableCell>
                      {columns.map(col => (
                        <TableCell key={col} className="max-w-[200px] truncate">
                          {row[col] !== null && typeof row[col] === 'object' 
                            ? JSON.stringify(row[col]) 
                            : String(row[col] || '-')}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                            onClick={() => router.push(`/${module}/${doctype}/${row.id || row.name}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          <div className="border-t border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-medium text-slate-900 dark:text-white">{data.length > 0 ? 1 : 0}</span> to <span className="font-medium text-slate-900 dark:text-white">{data.length}</span> of <span className="font-medium text-slate-900 dark:text-white">{data.length}</span> results
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 w-8 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400">
                1
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}

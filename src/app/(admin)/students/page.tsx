"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Eye, ArrowUp, Filter } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DataTablePagination } from "@/components/data-table-pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { StudentViewDialog } from "@/components/admin/student-view-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AcademicYear, FIXED_TERMS } from "@/types";

type Student = {
  id: string;
  roll_number: string;
  name: string;
  class: string;
  section: string;
  studying_year: string;
  student_types: { name: string } | null;
  academic_year_id: string | null;
};

type FilterOption = { id: string; name: string };

const PAGE_SIZE = 10;

export default function StudentListPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentToView, setStudentToView] = useState<string | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [studentsToDelete, setStudentsToDelete] = useState<string[]>([]);
  const [promoteAlertOpen, setPromoteAlertOpen] = useState(false);
  const [studentToPromote, setStudentToPromote] = useState<Student | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [bulkPromoteAlertOpen, setBulkPromoteAlertOpen] = useState(false);
  const [isBulkPromoting, setIsBulkPromoting] = useState(false);

  // Filter states
  const [selectedClass, setSelectedClass] = useState("all");
  const [selectedStudyingYear, setSelectedStudyingYear] = useState("all");
  const [selectedStudentType, setSelectedStudentType] = useState("all");
  const [selectedAcademicYearFilter, setSelectedAcademicYearFilter] = useState("all");
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState("all");
  
  const [targetAcademicYearForBulkPromote, setTargetAcademicYearForBulkPromote] = useState<string | null>(null);

  // Filter options
  const [classOptions, setClassOptions] = useState<FilterOption[]>([]);
  const [studyingYearOptions, setStudyingYearOptions] = useState<FilterOption[]>([]);
  const [studentTypeOptions, setStudentTypeOptions] = useState<FilterOption[]>([]);
  const [academicYearOptions, setAcademicYearOptions] = useState<AcademicYear[]>([]);

  const fetchFilterOptions = async () => {
    const [classRes, studyingYearRes, studentTypeRes, academicYearRes] = await Promise.all([
      supabase.from("class_groups").select("id, name"),
      supabase.from("studying_years").select("id, name"),
      supabase.from("student_types").select("id, name"),
      supabase.from("academic_years").select("id, year_name, is_active, created_at").order("year_name", { ascending: false }),
    ]);

    if (classRes.data) setClassOptions(classRes.data);
    if (studyingYearRes.data) setStudyingYearOptions(studyingYearRes.data);
    if (studentTypeRes.data) setStudentTypeOptions(studentTypeRes.data);
    if (academicYearRes.data) setAcademicYearOptions(academicYearRes.data);
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  const fetchStudents = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("students")
      .select("id, roll_number, name, class, section, studying_year, student_types(name), academic_year_id", { count: 'exact' });

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,roll_number.ilike.%${searchTerm}%`);
    }
    if (selectedClass !== 'all') {
      query = query.eq('class', selectedClass);
    }
    if (selectedStudyingYear !== 'all') {
      query = query.eq('studying_year', selectedStudyingYear);
    }
    if (selectedStudentType !== 'all') {
      query = query.eq('student_type_id', selectedStudentType);
    }
    if (selectedAcademicYearFilter !== 'all') {
      query = query.eq('academic_year_id', selectedAcademicYearFilter);
    }

    // Apply Payment Status filter logic
    if (selectedTerm !== 'all' && selectedPaymentStatus !== 'all') {
      const { data: outstandingIds } = await supabase.rpc('get_students_with_outstanding_invoices_by_term', {
        term_name_in: selectedTerm
      });
      
      const ids = (outstandingIds as string[]) || [];
      if (selectedPaymentStatus === 'outstanding') {
        if (ids.length > 0) {
          query = query.in('id', ids);
        } else {
          setStudents([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
      } else if (selectedPaymentStatus === 'paid') {
        if (ids.length > 0) {
          query = query.not('id', 'in', `(${ids.join(',')})`);
        }
      }
    }
    
    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data, error, count } = await query;

    if (error) {
      toast.error("Failed to fetch students.");
    } else if (data) {
      const mappedStudents = data.map((item: any) => ({
        id: item.id,
        roll_number: item.roll_number,
        name: item.name,
        class: item.class,
        section: item.section,
        studying_year: item.studying_year,
        student_types: item.student_types ? { name: item.student_types.name } : null,
        academic_year_id: item.academic_year_id,
      }));
      setStudents(mappedStudents);
      setTotalCount(count || 0);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, currentPage, selectedClass, selectedStudyingYear, selectedStudentType, selectedAcademicYearFilter, selectedTerm, selectedPaymentStatus]);

  const handleSelectAll = (checked: boolean) => {
    setSelectedStudents(checked ? students.map((s) => s.id) : []);
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedStudents(
      checked ? [...selectedStudents, id] : selectedStudents.filter((sId) => sId !== id)
    );
  };

  const openDeleteDialog = (ids: string[]) => {
    setStudentsToDelete(ids);
    setDeleteAlertOpen(true);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("students").delete().in("id", studentsToDelete);
    if (error) {
      toast.error("Failed to delete student(s).");
    } else {
      toast.success(`${studentsToDelete.length} student(s) deleted successfully.`);
      fetchStudents();
      setSelectedStudents([]);
    }
    setDeleteAlertOpen(false);
  };

  const handleView = (studentId: string) => {
    setStudentToView(studentId);
    setViewDialogOpen(true);
  };

  const getNextStudyingYear = (currentYear: string): string => {
    const yearMap: { [key: string]: string } = {
      '1st Year': '2nd Year',
      '2nd Year': '3rd Year',
      '3rd Year': 'Graduated',
    };
    return yearMap[currentYear] || currentYear;
  };

  const handlePromoteClick = (student: Student) => {
    setStudentToPromote(student);
    setPromoteAlertOpen(true);
  };

  const handlePromote = async () => {
    if (!studentToPromote) return;
    setIsPromoting(true);
    const toastId = toast.loading(`Promoting ${studentToPromote.name}...`);

    const nextStudyingYear = getNextStudyingYear(studentToPromote.studying_year);

    if (nextStudyingYear === studentToPromote.studying_year) {
      toast.info(`${studentToPromote.name} is already in their final year or cannot be promoted further.`, { id: toastId });
      setIsPromoting(false);
      setPromoteAlertOpen(false);
      return;
    }

    const { error } = await supabase
      .from("students")
      .update({ studying_year: nextStudyingYear })
      .eq("id", studentToPromote.id);

    if (error) {
      toast.error(`Failed to promote student: ${error.message}`, { id: toastId });
    } else {
      toast.success(`${studentToPromote.name} promoted to ${nextStudyingYear} successfully!`, { id: toastId });
      fetchStudents();
    }
    setIsPromoting(false);
    setPromoteAlertOpen(false);
  };

  const handleBulkPromote = async () => {
    if (!targetAcademicYearForBulkPromote) {
      toast.error("Please select a target studying year for bulk promotion.");
      return;
    }

    setIsBulkPromoting(true);
    const toastId = toast.loading(`Promoting ${selectedStudents.length} students...`);
    
    const targetStudyingYear = targetAcademicYearForBulkPromote;

    const studentsToUpdate = students.filter(s => selectedStudents.includes(s.id));
    const promotionPromises = studentsToUpdate.map(async (student) => {
      if (student.studying_year === targetStudyingYear) {
        return { id: student.id, status: 'skipped', message: `${student.name} is already in ${targetStudyingYear}.` };
      }

      const { error } = await supabase
        .from("students")
        .update({ studying_year: targetStudyingYear })
        .eq("id", student.id);
      
      if (error) {
        return { id: student.id, status: 'failed', message: `Failed to promote ${student.name}: ${error.message}` };
      }
      return { id: student.id, status: 'success', message: `${student.name} promoted to ${targetStudyingYear}.` };
    });

    const results = await Promise.all(promotionPromises);
    const successfulPromotions = results.filter(r => r.status === 'success').length;

    if (successfulPromotions > 0) {
      toast.success(`${successfulPromotions} students promoted successfully!`, { id: toastId });
    }

    fetchStudents();
    setSelectedStudents([]);
    setBulkPromoteAlertOpen(false);
    setIsBulkPromoting(false);
    setTargetAcademicYearForBulkPromote(null);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage student records and track payment statuses.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedStudents.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setBulkPromoteAlertOpen(true)}>
                    <ArrowUp className="h-3.5 w-3.5 mr-1" />
                    Promote ({selectedStudents.length})
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(selectedStudents)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete ({selectedStudents.length})
                  </Button>
                </>
              )}
              <Link href="/students/add">
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Student</span>
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="search-term">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search-term"
                  type="search"
                  placeholder="Name or roll..."
                  className="w-full rounded-lg bg-background pl-8 h-9"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={(value) => { setSelectedClass(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classOptions.map(option => <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Academic Year</Label>
              <Select value={selectedAcademicYearFilter} onValueChange={(value) => { setSelectedAcademicYearFilter(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {academicYearOptions.map(option => <SelectItem key={option.id} value={option.id}>{option.year_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Studying Year</Label>
              <Select value={selectedStudyingYear} onValueChange={(value) => { setSelectedStudyingYear(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Years" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {studyingYearOptions.map(option => <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Term-wise Filtering */}
            <div className="space-y-1.5">
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={(value) => { setSelectedTerm(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Terms" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {FIXED_TERMS.map(term => <SelectItem key={term.id} value={term.name}>{term.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment Status</Label>
              <Select value={selectedPaymentStatus} onValueChange={(value) => { setSelectedPaymentStatus(value); setCurrentPage(1); }}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="outstanding">Unpaid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <div className="flex items-center">
                    <Checkbox
                      checked={selectedStudents.length === students.length && students.length > 0}
                      onCheckedChange={(value) => handleSelectAll(!!value)}
                    />
                  </div>
                </TableHead>
                <TableHead>Roll Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Student Type</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center">Loading...</TableCell></TableRow>
              ) : students.length > 0 ? (
                students.map((student) => (
                  <TableRow key={student.id} data-state={selectedStudents.includes(student.id) && "selected"}>
                    <TableCell>
                      <div className="flex items-center">
                        <Checkbox
                          checked={selectedStudents.includes(student.id)}
                          onCheckedChange={(value) => handleSelectRow(student.id, !!value)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{student.roll_number}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.class}-{student.section}</TableCell>
                    <TableCell>{student.studying_year}</TableCell>
                    <TableCell>{student.student_types?.name || 'N/A'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Toggle menu</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => handleView(student.id)}><Eye className="mr-2 h-4 w-4" />View</DropdownMenuItem>
                          <DropdownMenuItem asChild><Link href={`/students/${student.id}/edit`}><Pencil className="mr-2 h-4 w-4" />Edit</Link></DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => handlePromoteClick(student)}><ArrowUp className="mr-2 h-4 w-4" />Promote</DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600" onSelect={() => openDeleteDialog([student.id])}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow><TableCell colSpan={7} className="text-center">No students found matching filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <DataTablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalCount={totalCount}
            pageSize={PAGE_SIZE}
          />
        </CardContent>
      </Card>
      <StudentViewDialog studentId={studentToView} open={viewDialogOpen} onOpenChange={setViewDialogOpen} />
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {studentsToDelete.length} student(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promoteAlertOpen} onOpenChange={setPromoteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to promote {studentToPromote?.name} to {getNextStudyingYear(studentToPromote?.studying_year || '')}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePromote} disabled={isPromoting}>
              {isPromoting ? "Promoting..." : "Promote Student"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkPromoteAlertOpen} onOpenChange={setBulkPromoteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Bulk Promotion</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to promote {selectedStudents.length} selected student(s).
              <div className="mt-4">
                <Label htmlFor="target-academic-year">Promote to Studying Year:</Label>
                <Select
                  value={targetAcademicYearForBulkPromote || ""}
                  onValueChange={setTargetAcademicYearForBulkPromote}
                >
                  <SelectTrigger id="target-academic-year" className="w-full mt-1">
                    <SelectValue placeholder="Select target year" />
                  </SelectTrigger>
                  <SelectContent>
                    {studyingYearOptions.map(option => (
                      <SelectItem key={option.id} value={option.name}>{option.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPromote} disabled={isBulkPromoting || !targetAcademicYearForBulkPromote}>
              {isBulkPromoting ? "Promoting..." : "Confirm Bulk Promote"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
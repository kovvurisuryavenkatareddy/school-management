"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PlusCircle, Search, MoreHorizontal, Pencil, Trash2, Eye, ArrowUp } from "lucide-react";
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

type Student = {
  id: string;
  roll_number: string;
  name: string;
  class: string;
  section: string;
  studying_year: string;
  student_types: { name: string } | null;
};

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

  const fetchStudents = async () => {
    setIsLoading(true);
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("students")
      .select("id, roll_number, name, class, section, studying_year, student_types(name)", { count: 'exact' });

    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,roll_number.ilike.%${searchTerm}%`);
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
        student_types: item.student_types ? { name: item.student_types.name } : null
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
  }, [searchTerm, currentPage]);

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
      fetchStudents(); // Refresh the list
    }
    setIsPromoting(false);
    setPromoteAlertOpen(false);
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Students</CardTitle>
              <CardDescription>Manage student records.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {selectedStudents.length > 0 && (
                <Button variant="destructive" size="sm" onClick={() => openDeleteDialog(selectedStudents)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Delete ({selectedStudents.length})
                </Button>
              )}
              <Link href="/students/add">
                <Button size="sm" className="gap-1">
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Student</span>
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by name or roll number..."
              className="w-full rounded-lg bg-background pl-8 md:w-[300px]"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
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
                <TableRow><TableCell colSpan={7} className="text-center">No students found.</TableCell></TableRow>
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
              Are you sure you want to promote {studentToPromote?.name} from {studentToPromote?.studying_year} to {getNextStudyingYear(studentToPromote?.studying_year || '')}?
              This action will update their studying year.
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
    </>
  );
}
"use client";

import { useEffect, useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeStructure, FeeItem, StudyingYear, Term, FIXED_TERMS } from "@/types";
import { getFeeTypesFromStructure, normalizeFeeStructure } from "@/lib/fee-structure-utils";

const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

interface FeeStructureEditorProps {
  value: any;
  onChange: (value: FeeStructure) => void;
  studyingYears: StudyingYear[];
}

export function FeeStructureEditor({ value, onChange, studyingYears }: FeeStructureEditorProps) {
  const [selectedStudyingYear, setSelectedStudyingYear] = useState<string>('');
  const [feeTypeDialogOpen, setFeeTypeDialogOpen] = useState(false);
  const [newFeeTypeName, setNewFeeTypeName] = useState("");

  const normalizedValue = useMemo(() => normalizeFeeStructure(value), [value]);

  useEffect(() => {
    if (studyingYears.length > 0 && !selectedStudyingYear) {
      setSelectedStudyingYear(studyingYears[0].name);
    }
  }, [studyingYears, selectedStudyingYear]);

  const currentYearFeeItems = normalizedValue[selectedStudyingYear] || [];
  const allFeeTypes = getFeeTypesFromStructure(normalizedValue);
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const handleAddFeeType = () => {
    const trimmedFeeType = newFeeTypeName.trim();
    if (!trimmedFeeType) {
      toast.error("Fee type name cannot be empty.");
      return;
    }
    if (BASE_FEE_TYPES.includes(trimmedFeeType) || allFeeTypes.includes(trimmedFeeType)) {
      toast.error(`Fee type "${trimmedFeeType}" already exists.`);
      return;
    }

    const newValue = JSON.parse(JSON.stringify(normalizedValue));
    studyingYears.forEach(sYear => {
      const yearName = sYear.name;
      if (!newValue[yearName]) newValue[yearName] = [];
      FIXED_TERMS.forEach(term => {
        newValue[yearName].push({
          id: uuidv4(),
          name: trimmedFeeType,
          amount: 0,
          concession: 0,
          term_name: term.name,
        });
      });
    });
    onChange(newValue);
    setNewFeeTypeName("");
    setFeeTypeDialogOpen(false);
  };

  const handleDeleteFeeType = (feeTypeToDelete: string) => {
    if (BASE_FEE_TYPES.includes(feeTypeToDelete)) {
      toast.error(`Cannot delete base fee type "${feeTypeToDelete}".`);
      return;
    }
    const newValue = JSON.parse(JSON.stringify(normalizedValue));
    studyingYears.forEach(sYear => {
      const yearName = sYear.name;
      if (newValue[yearName]) {
        newValue[yearName] = newValue[yearName].filter((item: FeeItem) => item.name !== feeTypeToDelete);
      }
    });
    onChange(newValue);
  };

  const handleInputChange = (
    studyingYear: string,
    termName: string,
    feeTypeName: string,
    field: 'amount' | 'concession',
    inputValue: string
  ) => {
    const newValue = JSON.parse(JSON.stringify(normalizedValue));
    if (!newValue[studyingYear]) newValue[studyingYear] = [];

    let feeItem = newValue[studyingYear].find(
      (item: FeeItem) => item.term_name === termName && item.name === feeTypeName
    );

    if (!feeItem) {
      feeItem = {
        id: uuidv4(),
        name: feeTypeName,
        amount: 0,
        concession: 0,
        term_name: termName,
      };
      newValue[studyingYear].push(feeItem);
    }

    feeItem[field] = parseFloat(inputValue) || 0;
    onChange(newValue);
  };

  const getFeeItem = (termName: string, feeTypeName: string): FeeItem | undefined => {
    return currentYearFeeItems.find(item => item.term_name === termName && item.name === feeTypeName);
  };

  if (!selectedStudyingYear || studyingYears.length === 0) {
    return <Card><CardHeader><CardTitle>Fee Structure</CardTitle></CardHeader><CardContent><p>Loading configuration...</p></CardContent></Card>;
  }

  const uniqueFeeTypesInYear = Array.from(new Set([...BASE_FEE_TYPES, ...currentYearFeeItems.map(item => item.name)])).sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fee Structure</CardTitle>
            <CardDescription>Amounts per term. Tuition: Terms 1&2 | JVD: Term 3 only.</CardDescription>
          </div>
          <Dialog open={feeTypeDialogOpen} onOpenChange={setFeeTypeDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="gap-1">
                <PlusCircle className="h-4 w-4" /> Add Custom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Custom Fee Type</DialogTitle></DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="fee-type-name">Fee Type Name</Label>
                <Input id="fee-type-name" value={newFeeTypeName} onChange={(e) => setNewFeeTypeName(e.target.value)} placeholder="e.g., Exam Fee" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFeeTypeDialogOpen(false)}>Cancel</Button>
                <Button type="button" onClick={handleAddFeeType}>Add Fee Type</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-6">
          <Label>Select Year</Label>
          <Select value={selectedStudyingYear} onValueChange={setSelectedStudyingYear}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {studyingYears.map(sYear => <SelectItem key={sYear.id} value={sYear.name}>{sYear.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">Term</TableHead>
                {uniqueFeeTypesInYear.map(feeType => (
                  <TableHead key={feeType} className="text-center min-w-[110px]">
                    <div className="flex items-center justify-center gap-1">
                      {feeType}
                      {!BASE_FEE_TYPES.includes(feeType) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground"><Trash2 className="h-3 w-3" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete {feeType}?</AlertDialogTitle><AlertDialogDescription>This removes it from all years/terms.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteFeeType(feeType)}>Delete</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center w-[110px]">Concession</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTerms.map(term => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium">{term.name}</TableCell>
                  {uniqueFeeTypesInYear.map(feeType => {
                    const item = getFeeItem(term.name, feeType);
                    
                    // Logic: Hide Tuition in Term 3, Hide JVD in Term 1 & 2
                    const isDisabled = (feeType === 'Tuition Fee' && term.name === 'Term 3') || 
                                     (feeType === 'JVD Fee' && (term.name === 'Term 1' || term.name === 'Term 2'));
                    
                    if (isDisabled) return <TableCell key={feeType} className="bg-muted/10 text-center text-xs text-muted-foreground italic">N/A</TableCell>;

                    return (
                      <TableCell key={feeType} className="p-1">
                        <Input
                          type="number"
                          value={item?.amount || 0}
                          onChange={(e) => handleInputChange(selectedStudyingYear, term.name, feeType, 'amount', e.target.value)}
                          className="h-8 text-center"
                        />
                      </TableCell>
                    );
                  })}
                  <TableCell className="p-1">
                    {/* Concession only for Tuition Fee rows (Term 1 & 2) */}
                    {(term.name === 'Term 1' || term.name === 'Term 2') ? (
                      <Input
                        type="number"
                        value={getFeeItem(term.name, 'Tuition Fee')?.concession || 0}
                        onChange={(e) => handleInputChange(selectedStudyingYear, term.name, 'Tuition Fee', 'concession', e.target.value)}
                        className="h-8 text-center border-blue-200"
                      />
                    ) : (
                      <div className="text-center text-xs text-muted-foreground">N/A</div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
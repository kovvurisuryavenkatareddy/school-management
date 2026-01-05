"use client";

import { useEffect, useState } from "react";
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
import { getFeeTypesFromStructure } from "@/lib/fee-structure-utils";

const BASE_FEE_TYPES = ['Tuition Fee', 'Management Fee', 'JVD Fee'];

interface FeeStructureEditorProps {
  value: FeeStructure;
  onChange: (value: FeeStructure) => void;
  studyingYears: StudyingYear[];
}

export function FeeStructureEditor({ value, onChange, studyingYears }: FeeStructureEditorProps) {
  const [selectedStudyingYear, setSelectedStudyingYear] = useState<string>(studyingYears[0]?.name || '');
  const [feeTypeDialogOpen, setFeeTypeDialogOpen] = useState(false);
  const [newFeeTypeName, setNewFeeTypeName] = useState("");

  useEffect(() => {
    if (studyingYears.length > 0 && !selectedStudyingYear) {
      setSelectedStudyingYear(studyingYears[0].name);
    }
  }, [studyingYears, selectedStudyingYear]);

  const currentYearFeeItems = value[selectedStudyingYear] || [];
  const allFeeTypes = getFeeTypesFromStructure(value);
  const sortedTerms = FIXED_TERMS.sort((a, b) => a.name.localeCompare(b.name));

  const handleAddFeeType = () => {
    const trimmedFeeType = newFeeTypeName.trim();
    if (!trimmedFeeType) {
      toast.error("Fee type name cannot be empty.");
      return;
    }
    if (BASE_FEE_TYPES.includes(trimmedFeeType) || allFeeTypes.includes(trimmedFeeType)) {
      toast.error(`Fee type "${trimmedFeeType}" already exists or is a base type.`);
      return;
    }

    const newValue = JSON.parse(JSON.stringify(value));
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
    const newValue = JSON.parse(JSON.stringify(value));
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
    const newValue = JSON.parse(JSON.stringify(value));
    let feeItem = newValue[studyingYear]?.find(
      (item: FeeItem) => item.term_name === termName && item.name === feeTypeName
    );

    // If item doesn't exist (e.g., custom fee type was added but not for this specific term yet)
    if (!feeItem) {
      if (!newValue[studyingYear]) newValue[studyingYear] = [];
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
    return <Card><CardHeader><CardTitle>Fee Structure</CardTitle></CardHeader><CardContent><p>Loading fee structure configuration...</p></CardContent></Card>;
  }

  const uniqueFeeTypesInSelectedYear = Array.from(new Set([...BASE_FEE_TYPES, ...currentYearFeeItems.map(item => item.name)])).sort();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fee Structure</CardTitle>
            <CardDescription>Define the fee structure. Note: JVD Fee is only applicable to Term 3.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Dialog open={feeTypeDialogOpen} onOpenChange={setFeeTypeDialogOpen}>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="outline" className="gap-1">
                  <PlusCircle className="h-4 w-4" /> Add Custom Fee Type
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
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Label htmlFor="select-studying-year">Select Studying Year</Label>
          <Select value={selectedStudyingYear} onValueChange={setSelectedStudyingYear}>
            <SelectTrigger id="select-studying-year" className="w-[180px]">
              <SelectValue placeholder="Select a year" />
            </SelectTrigger>
            <SelectContent>
              {studyingYears.map(sYear => (
                <SelectItem key={sYear.id} value={sYear.name}>{sYear.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-full border">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-background border-r min-w-[150px]">Term</TableHead>
                {uniqueFeeTypesInSelectedYear.map(feeType => (
                  <TableHead key={feeType} className="text-center border-l min-w-[120px]">
                    <div className="flex items-center justify-between">
                      {feeType}
                      {!BASE_FEE_TYPES.includes(feeType) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Delete "{feeType}"?</AlertDialogTitle><AlertDialogDescription>This will remove this fee type from all terms and years. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteFeeType(feeType)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-center border-l min-w-[120px]">Concession</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTerms.map(term => (
                <TableRow key={term.id}>
                  <TableCell className="font-medium sticky left-0 z-10 bg-background border-r">{term.name}</TableCell>
                  {uniqueFeeTypesInSelectedYear.map(feeType => {
                    const item = getFeeItem(term.name, feeType);
                    const isJvdRestricted = feeType === 'JVD Fee' && term.name !== 'Term 3';
                    
                    return (
                      <TableCell key={feeType} className="border-l">
                        {isJvdRestricted ? (
                          <div className="text-center text-xs text-muted-foreground italic">N/A</div>
                        ) : (
                          <Input
                            type="number"
                            value={item?.amount || 0}
                            onChange={(e) => handleInputChange(selectedStudyingYear, term.name, feeType, 'amount', e.target.value)}
                            className="h-8"
                          />
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="border-l">
                    <Input
                      type="number"
                      value={currentYearFeeItems.find(item => item.term_name === term.name && item.name === 'Tuition Fee')?.concession || 0}
                      onChange={(e) => handleInputChange(selectedStudyingYear, term.name, 'Tuition Fee', 'concession', e.target.value)}
                      className="h-8"
                    />
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
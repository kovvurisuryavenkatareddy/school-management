"use client";

import { useEffect, useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FeeStructure, FeeItem, StudyingYear, FIXED_TERMS } from "@/types";
import { normalizeFeeStructure } from "@/lib/fee-structure-utils";

interface FeeStructureEditorProps {
  value: any;
  onChange: (value: FeeStructure) => void;
  studyingYears: StudyingYear[];
}

export function FeeStructureEditor({ value, onChange, studyingYears }: FeeStructureEditorProps) {
  const [selectedYear, setSelectedYear] = useState<string>('');
  const normalizedValue = useMemo(() => normalizeFeeStructure(value), [value]);

  useEffect(() => {
    if (studyingYears.length > 0 && !selectedYear) {
      setSelectedYear(studyingYears[0].name);
    }
  }, [studyingYears, selectedYear]);

  const currentYearItems = normalizedValue[selectedYear] || [];
  const getAmount = (name: string) => currentYearItems.find(i => i.name === name)?.amount || 0;
  const getConc = (name: string) => currentYearItems.find(i => i.name === name)?.concession || 0;

  const handleUpdate = (name: string, field: 'amount' | 'concession', val: string) => {
    const num = parseFloat(val) || 0;
    const newValue = JSON.parse(JSON.stringify(normalizedValue));
    if (!newValue[selectedYear]) newValue[selectedYear] = [];

    let item = newValue[selectedYear].find((i: any) => i.name === name);
    if (!item) {
      item = { id: uuidv4(), name, amount: 0, concession: 0, term_name: name.includes('Term') ? name : 'Total' };
      newValue[selectedYear].push(item);
    }
    item[field] = num;
    onChange(newValue);
  };

  if (!selectedYear) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Term-wise Fee Configuration</CardTitle>
            <CardDescription className="text-xs">Enter amounts for each term and total concession.</CardDescription>
          </div>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] h-8 text-xs font-semibold"><SelectValue /></SelectTrigger>
            <SelectContent>
              {studyingYears.map(y => <SelectItem key={y.id} value={y.name}>{y.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {['Term 1', 'Term 2', 'Term 3'].map(term => (
            <div key={term} className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground uppercase">{term} Amount</Label>
              <Input 
                type="number" 
                value={getAmount(term)} 
                onChange={e => handleUpdate(term, 'amount', e.target.value)} 
                className="h-9 font-medium"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-primary uppercase">Yearly Concession</Label>
            <Input 
              type="number" 
              value={getConc('Yearly Concession')} 
              onChange={e => handleUpdate('Yearly Concession', 'concession', e.target.value)} 
              className="h-9 font-bold border-primary/30 text-primary"
            />
          </div>
        </div>
        
        <div className="mt-6 p-3 rounded-lg bg-primary/5 border border-primary/10 flex justify-between items-center">
          <span className="text-sm font-semibold text-muted-foreground">Calculated Total Payable:</span>
          <span className="text-lg font-black text-primary">
            ₹{(getAmount('Term 1') + getAmount('Term 2') + getAmount('Term 3') - getConc('Yearly Concession')).toLocaleString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
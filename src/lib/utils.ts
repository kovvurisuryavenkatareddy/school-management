import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function numberToWords(num: number): string {
  const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  const convertHundreds = (n: number): string => {
    let result = '';
    if (n > 99) {
      result += ones[Math.floor(n / 100)] + ' hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (result !== '') result += 'and ';
      if (n < 10) {
        result += ones[n];
      } else if (n < 20) {
        result += teens[n - 10];
      } else {
        result += tens[Math.floor(n / 10)];
        if (n % 10 > 0) {
          result += ' ' + ones[n % 10];
        }
      }
    }
    return result;
  };

  if (num === 0) return 'Zero';
  
  const numStr = num.toString();
  const [integerPartStr] = numStr.split('.');
  const integerPart = parseInt(integerPartStr, 10);

  let words = '';
  if (integerPart >= 10000000) {
    words += convertHundreds(Math.floor(integerPart / 10000000)) + ' crore ';
  }
  if (integerPart % 10000000 >= 100000) {
    words += convertHundreds(Math.floor((integerPart % 10000000) / 100000)) + ' lakh ';
  }
  if (integerPart % 100000 >= 1000) {
    words += convertHundreds(Math.floor((integerPart % 100000) / 1000)) + ' thousand ';
  }
  if (integerPart % 1000 > 0) {
    words += convertHundreds(integerPart % 1000);
  }

  const finalWords = words.trim().replace(/\s+/g, ' ');
  return finalWords.charAt(0).toUpperCase() + finalWords.slice(1) + ' Only';
}
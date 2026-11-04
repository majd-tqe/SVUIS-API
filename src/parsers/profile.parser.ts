import * as cheerio from 'cheerio';
import { SvuisParseError } from '../errors/index.js';
import type { StudentProfile } from '../types/index.js';

function extractName($: cheerio.CheerioAPI, full: string): string {
  const parts = full.split(' ').filter(Boolean);
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

export function parseProfile(html: string): StudentProfile {
  const $ = cheerio.load(html);

  const summaryDiv = $('div:contains("Student ID:")').first();
  if (!summaryDiv.length) {
    throw new SvuisParseError('Could not find profile summary div', 'std_profileP.php', html.slice(0, 500));
  }
  const summaryHtml = summaryDiv.html() || '';

  function extract(label: string): string {
    const re = new RegExp(`${label}:\\s*<span[^>]*>([^<]*)</span>`, 'i');
    const m = summaryHtml.match(re);
    return m ? m[1].trim() : '';
  }

  const rawName = extract('Student Name');
  const profile: StudentProfile = {
    id: parseInt(extract('Student ID') || '0', 10),
    username: extract('Login Name') || '',
    names: {
      firstAr: '', fatherAr: '', motherAr: '', surnameAr: '',
      firstEn: '', fatherEn: '', motherEn: '', surnameEn: '',
      fullAr: '', fullEn: extractName($, rawName),
    },
    birth: { date: '', place: '' },
    gender: '',
    maritalStatus: '',
    militaryStatus: '',
    nationality: '',
    sidNumber: '',
    contact: { country: '', city: '', address: '', phone: '', mobile: '', email: '' },
    registration: {
      date: extract('Registration Date'),
      term: extract('Registration Term'),
      status: extract('Student Status'),
    },
    account: {
      id: parseInt(extract('Student Account ID') || '0', 10),
      currency: extract('Student Account Currecny'),
      balance: parseFloat(extract('Student Account Balance') || '0'),
      status: extract('Student Account Status'),
    },
    programs: [],
    documents: [],
  };

  const infoTable = $('table').filter((_, table) =>
    $(table).find('table').length === 0 && $(table).find('td.tdhead_left_colored').toArray()
      .some(td => $(td).text().trim().toLowerCase() === 'first name')
  ).first();
  if (infoTable.length) {
    const rows = infoTable.find('tr').toArray();
    const map: Record<string, string> = {};

    for (const row of rows) {
      const cells = $(row).find('td').toArray();
      if (cells.length < 2) continue;

      for (let i = 0; i < cells.length - 1; i++) {
        const label = $(cells[i]).text().trim().toLowerCase();
        const value = $(cells[i + 1]).text().trim();
        if (label && value && !label.includes('nbsp') && !label.includes('images')) {
          if ($(cells[i]).hasClass('tdhead_left_colored')) {
            map[label] = value;
          }
        }
      }
    }

    const names = profile.names;
    names.firstEn = map['first name'] || '';
    names.fatherEn = map['father name'] || '';
    names.motherEn = map['mother name'] || '';
    names.surnameEn = map['surname'] || '';

    const arabicRows = infoTable.find('tr').toArray();
    for (const row of arabicRows) {
      const cells = $(row).find('td').toArray();
      if (cells.length >= 4) {
        const label1 = $(cells[0]).text().trim().toLowerCase();
        const val1 = $(cells[1]).text().trim();
        const label2 = $(cells[2]).text().trim().toLowerCase();
        const val2 = $(cells[3]).text().trim();
        if (label1 === 'first name' && label2 === 'in arabic' && val2) names.firstAr = val2;
        if (label1 === 'father name' && label2 === 'in arabic' && val2) names.fatherAr = val2;
        if (label1 === 'mother name' && label2 === 'in arabic' && val2) names.motherAr = val2;
        if (label1 === 'surname' && label2 === 'in arabic' && val2) names.surnameAr = val2;
      }
    }

    names.fullAr = `${names.firstAr} ${names.fatherAr} ${names.motherAr} ${names.surnameAr}`.trim();

    profile.birth.place = map['place of birth'] || '';
    profile.birth.date = map['date of birth'] || '';
    profile.gender = mapGender(map['gender'] || '');
    profile.maritalStatus = mapMaritalStatus(map['martial status'] || map['marital status'] || '');
    profile.militaryStatus = mapMilitaryStatus(map['military status'] || '');
    profile.nationality = map['nationality'] || '';
    profile.sidNumber = map['sid'] || map['sid number'] || '';
    profile.contact.country = map['country'] || '';
    profile.contact.city = map['city'] || '';
    profile.contact.address = map['address'] || '';
    profile.contact.phone = map['phone'] || '';
    profile.contact.mobile = map['mobile'] || '';
    profile.contact.email = map['email'] || '';
  }

  $('table').filter((_, table) => $(table).find('table').length === 0).each((_, table) => {
    const rows = $(table).find('tr');
    const headers = rows.first().children('td, th').map((__, c) => $(c).text().trim().toLowerCase()).get();
    if (headers.includes('program info')) {
      rows.slice(1).each((__, row) => {
        const text = $(row).children('td').first().text().replace(/\s+/g, ' ').trim();
        if (text) profile.programs.push(text);
      });
    }
    if (headers.includes('archive name')) {
      rows.slice(1).each((__, row) => {
        const text = $(row).children('td').first().text().replace(/\s+/g, ' ').trim();
        if (text) profile.documents.push(text);
      });
    }
  });

  if (!profile.id) {
    throw new SvuisParseError('Could not find student ID in profile page', 'std_profileP.php', html.slice(0, 500));
  }

  return profile;
}

function mapGender(val: string): string {
  if (val === '0' || val.toLowerCase() === 'male' || val.toLowerCase() === 'ذكر') return 'Male';
  if (val === '1' || val.toLowerCase() === 'female' || val.toLowerCase() === 'أنثى') return 'Female';
  return val || '';
}

function mapMaritalStatus(val: string): string {
  if (val === '0' || val.toLowerCase() === 'single' || val.toLowerCase() === 'أعزب') return 'Single';
  if (val === '1' || val.toLowerCase() === 'married' || val.toLowerCase() === 'متزوج') return 'Married';
  return val || '';
}

function mapMilitaryStatus(val: string): string {
  if (val === '0') return 'Completed';
  if (val === '1') return 'Postponed';
  if (val === '2') return 'Exempt';
  return val || '';
}

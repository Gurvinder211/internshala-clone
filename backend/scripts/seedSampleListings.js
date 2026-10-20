import mongoose from 'mongoose';
import { connect } from '../db.js';
import Internship from '../Model/Internship.js';
import Job from '../Model/Job.js';

const jobs = [
  {
    title: 'Frontend Developer (Demo)',
    company: 'Blue Oak Studio - Demo',
    location: 'Remote, India',
    Experience: '0-2 years',
    category: 'Engineering',
    aboutCompany: 'Fictional sample company for demonstrating job listings.',
    aboutJob: 'Build accessible, responsive web interfaces with a small product team. This is sample data, not a real vacancy.',
    whoCanApply: 'Applicants familiar with JavaScript, React, and basic web accessibility.',
    perks: ['Remote work', 'Mentorship', 'Flexible hours'],
    AdditionalInfo: 'Demo listing only. Do not submit a real application.',
    CTC: '₹6-9 LPA (sample)',
    StartDate: 'Flexible',
  },
  {
    title: 'Junior Data Analyst (Demo)',
    company: 'Cedar Metrics - Demo',
    location: 'Bengaluru, India',
    Experience: '0-1 years',
    category: 'Data & Analytics',
    aboutCompany: 'Fictional sample company for demonstrating job listings.',
    aboutJob: 'Prepare reports, explore datasets, and communicate useful findings. This is sample data, not a real vacancy.',
    whoCanApply: 'Applicants with spreadsheet skills and introductory SQL or Python knowledge.',
    perks: ['Learning budget', 'Hybrid schedule', 'Team mentoring'],
    AdditionalInfo: 'Demo listing only. Do not submit a real application.',
    CTC: '₹4-6 LPA (sample)',
    StartDate: 'Flexible',
  },
  {
    title: 'Product Design Associate (Demo)',
    company: 'Paper Kite Products - Demo',
    location: 'Pune, India',
    Experience: '0-2 years',
    category: 'Design',
    aboutCompany: 'Fictional sample company for demonstrating job listings.',
    aboutJob: 'Support user research, prototypes, and design-system improvements. This is sample data, not a real vacancy.',
    whoCanApply: 'Applicants with a design portfolio and familiarity with Figma or similar tools.',
    perks: ['Portfolio reviews', 'Flexible hours', 'Hybrid schedule'],
    AdditionalInfo: 'Demo listing only. Do not submit a real application.',
    CTC: '₹5-7 LPA (sample)',
    StartDate: 'Flexible',
  },
];

const internships = [
  {
    title: 'Software Engineering Intern (Demo)',
    company: 'Mango Byte Labs - Demo',
    location: 'Remote, India',
    category: 'Engineering',
    aboutCompany: 'Fictional sample company for demonstrating internship listings.',
    aboutInternship: 'Work on small frontend and API tasks with code review and weekly mentoring. This is sample data, not a real opening.',
    whoCanApply: 'Students familiar with JavaScript, Git, and basic web development.',
    perks: ['Mentorship', 'Remote work', 'Certificate'],
    numberOfOpening: '2',
    stipend: '₹12,000/month (sample)',
    startDate: 'Flexible',
    additionalInfo: 'Demo listing only. Do not submit a real application.',
  },
  {
    title: 'Content Research Intern (Demo)',
    company: 'Willow Research House - Demo',
    location: 'Delhi, India',
    category: 'Research & Content',
    aboutCompany: 'Fictional sample company for demonstrating internship listings.',
    aboutInternship: 'Research topics, organize sources, and help draft clear educational content. This is sample data, not a real opening.',
    whoCanApply: 'Students with strong writing, research, and fact-checking skills.',
    perks: ['Writing mentorship', 'Hybrid schedule', 'Certificate'],
    numberOfOpening: '1',
    stipend: '₹8,000/month (sample)',
    startDate: 'Flexible',
    additionalInfo: 'Demo listing only. Do not submit a real application.',
  },
  {
    title: 'Social Media Design Intern (Demo)',
    company: 'Sunroom Creative - Demo',
    location: 'Mumbai, India',
    category: 'Design',
    aboutCompany: 'Fictional sample company for demonstrating internship listings.',
    aboutInternship: 'Create social campaign concepts and simple visual assets with feedback from a design mentor. This is sample data, not a real opening.',
    whoCanApply: 'Students with a visual design portfolio and basic image-editing skills.',
    perks: ['Portfolio projects', 'Flexible hours', 'Certificate'],
    numberOfOpening: '2',
    stipend: '₹10,000/month (sample)',
    startDate: 'Flexible',
    additionalInfo: 'Demo listing only. Do not submit a real application.',
  },
];

async function seedModel(Model, records) {
  for (const record of records) {
    await Model.updateOne(
      { title: record.title, company: record.company },
      { $setOnInsert: record },
      { upsert: true }
    );
  }
}

try {
  await connect();
  await seedModel(Job, jobs);
  await seedModel(Internship, internships);
  console.log(`Sample listings ready: ${jobs.length} jobs and ${internships.length} internships.`);
} catch (error) {
  console.error('Could not seed sample listings:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
import swaggerJsdoc from 'swagger-jsdoc';
import { CONFIG } from './config.js';
import { fileURLToPath } from 'node:url';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SVUIS API',
    version: '2.0.0',
    description: `Unofficial REST API wrapper for the **Syrian Virtual University Information System (SVUIS)**.

Scrapes and extracts student data from the SVUIS portal and exposes it through a clean REST interface.

[GitHub Repository](https://github.com/majd-tqe/SVUIS-API)`,
    contact: {
      name: 'SVUIS API',
      url: 'https://github.com/majd-tqe/SVUIS-API',
    },
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server health and status' },
    { name: 'Auth', description: 'Authentication (login/logout/status)' },
    { name: 'Student', description: 'Student profile and photo' },
    { name: 'Studies', description: 'Semester grades, current average, exam schedule' },
    { name: 'Payments', description: 'Payment history and e-payment status' },
    { name: 'Assessments', description: 'AMS assessments (online quizzes/tests)' },
    { name: 'Classes', description: 'Current semester classes' },
    { name: 'Tutors', description: 'Tutor reports and options' },
    { name: 'Account', description: 'Password management and document uploads' },
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'svuis_sid',
        description: 'Session cookie obtained from POST /auth/login',
      },
    },
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object', nullable: true },
          error: { type: 'string', nullable: true },
          meta: {
            type: 'object',
            properties: {
              cached: { type: 'boolean' },
              fetchedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', example: 'test_student', description: 'SVUIS login name' },
          password: { type: 'string', example: 'mypassword', description: 'SVUIS password' },
          otp: { type: 'string', example: '', description: 'One-time password (if 2FA enabled)' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              student: {
                type: 'object',
                properties: {
                  id: { type: 'integer', example: 12345 },
                  username: { type: 'string', example: 'test_student' },
                  name: { type: 'string', example: 'John Doe' },
                },
              },
            },
          },
        },
      },
      StudentProfile: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 12345 },
          username: { type: 'string', example: 'test_student' },
          names: {
            type: 'object',
            properties: {
              fullAr: { type: 'string', example: 'جون دو' },
              fullEn: { type: 'string', example: 'John Doe' },
              firstAr: { type: 'string' }, fatherAr: { type: 'string' },
              motherAr: { type: 'string' }, surnameAr: { type: 'string' },
              firstEn: { type: 'string' }, fatherEn: { type: 'string' },
              motherEn: { type: 'string' }, surnameEn: { type: 'string' },
            },
          },
          birth: {
            type: 'object',
            properties: {
              date: { type: 'string', example: '01/01/2000' },
              place: { type: 'string', example: 'Damascus' },
            },
          },
          gender: { type: 'string', example: 'Male' },
          maritalStatus: { type: 'string', example: 'Single' },
          militaryStatus: { type: 'string', example: 'Exempt' },
          nationality: { type: 'string', example: 'Syrian' },
          sidNumber: { type: 'string', example: '0101012345' },
          contact: {
            type: 'object',
            properties: {
              country: { type: 'string' }, city: { type: 'string' },
              address: { type: 'string' }, phone: { type: 'string' },
              mobile: { type: 'string' }, email: { type: 'string' },
            },
          },
          registration: {
            type: 'object',
            properties: {
              date: { type: 'string' }, term: { type: 'string' },
              status: { type: 'string', example: 'Active' },
            },
          },
          account: {
            type: 'object',
            properties: {
              id: { type: 'integer' }, currency: { type: 'string' },
              balance: { type: 'number' }, status: { type: 'string' },
            },
          },
          programs: { type: 'array', items: { type: 'string' } },
          documents: { type: 'array', items: { type: 'string' } },
        },
      },
      Semester: {
        type: 'object',
        properties: {
          term: { type: 'string', example: 'Spring' },
          termCode: { type: 'string', example: 'S24' },
          year: { type: 'string', example: '2024' },
          courses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'CS101' },
                name: { type: 'string', example: 'Introduction to Programming' },
                chr: { type: 'number', example: 3 },
                mark: { type: 'number', nullable: true, example: 85, description: 'Null for registered, exempt or unavailable marks' },
                letterGrade: { type: 'string', example: 'B+' },
                gpaValue: { type: 'number', nullable: true, example: 3.25 },
                gradeSource: { type: 'string', enum: ['derived'], description: 'Letter/GPA derived from the displayed scale, not the official cumulative GPA' },
                status: { type: 'string', example: 'R', description: 'Source status preserved (observed R, P, F, E); never inferred from total mark' },
                term: { type: 'string', example: 'F25' },
                class: { type: 'string' },
                specialStatus: { type: 'string' },
                finalAttendance: { type: 'string' },
                weights: { $ref: '#/components/schemas/GradeWeights' },
                scores: { $ref: '#/components/schemas/GradeScores' },
                helped: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
      CurrentAverage: {
        type: 'object',
        properties: {
          program: { type: 'string', example: 'Information Technology Engineering' },
          specialization: { type: 'string', example: 'Software Engineering' },
          studentTerm: { type: 'string', example: '2024 Spring' },
          average: { type: 'number', example: 82.45 },
          gpa: { type: 'number', example: 3.2 },
          literalGrade: { type: 'string', example: 'B' },
          completedPass: { type: 'integer', example: 24 },
          completedExempt: { type: 'integer', example: 6, description: 'E credit total from the official summary' },
          completedExam: { type: 'integer', example: 6, deprecated: true, description: 'Compatibility alias of completedExempt; does not mean exams' },
          chr: { type: 'number', example: 30, description: 'Completed passed plus exempt credits' },
          englishChr: { type: 'number', example: 6 },
          engPt: { type: 'number', example: 60, description: 'Placement-test value as published' },
          courses: { type: 'array', items: { $ref: '#/components/schemas/GradeEntry' } },
        },
      },
      ClassAssignData: {
        type: 'object', description: 'Listing only; registration/submission is not implemented',
        properties: {
          termId: { type: 'string' }, studentId: { type: 'string' }, programId: { type: 'string' },
          groups: { type: 'array', items: { type: 'object', properties: {
            name: { type: 'string' }, specialization: { type: 'string' },
            courses: { type: 'array', items: { type: 'object', properties: {
              code: { type: 'string' }, chr: { type: 'string' }, name: { type: 'string' },
              status: { type: 'array', items: { type: 'object', properties: {
                letter: { type: 'string' }, label: { type: 'string' }, color: { type: 'string' },
              } } },
            } } },
          } } },
        },
      },
      GradeWeights: {
        type: 'object',
        properties: Object.fromEntries(['e1', 'e2', 'e3', 'midterm', 'oral', 'practical', 'finalExam', 'total'].map(key => [key, { type: 'number' }])),
      },
      GradeScores: {
        type: 'object',
        description: 'Null means missing/not applicable; zero is a real published score',
        properties: Object.fromEntries(['e1', 'e2', 'e3', 'midterm', 'oral', 'practical', 'finalExam', 'total'].map(key => [key, { type: 'number', nullable: true }])),
      },
      GradeEntry: {
        type: 'object', properties: {
          status: { type: 'string' }, courseCode: { type: 'string' }, chr: { type: 'number' },
          mark: { type: 'number', nullable: true }, term: { type: 'string' }, letterGrade: { type: 'string' },
          gpaValue: { type: 'number', nullable: true }, gradeSource: { type: 'string', enum: ['portal', 'unavailable'] },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'PAY-2024-001' },
          description: { type: 'string', example: 'Tuition Fee 2024 Spring' },
          status: { type: 'string', example: 'Paid' },
          term: { type: 'string', example: 'Spring 2024' },
          date: { type: 'string', example: '2024-01-15T00:00:00', description: 'Local upstream timestamp; no timezone is assumed' },
          validator: { type: 'string', example: 'admin' },
          amount: { type: 'number', example: 150000 },
          currency: { type: 'string', example: 'SYP' },
          specialAmount: { type: 'number', example: 0 },
          program: { type: 'string', example: 'ITE' },
          forDelete: { type: 'string', example: 'No' },
          processStatus: { type: 'string', example: 'Completed' },
          link: { type: 'string', example: '' },
        },
      },
      ExamEntry: {
        type: 'object',
        properties: {
          course: { type: 'string', example: 'CS101' },
          class: { type: 'string', example: 'A' },
          date: { type: 'string', example: '2024-06-10' },
          startTime: { type: 'string', example: '09:00' },
          endTime: { type: 'string', example: '11:00' },
          duration: { type: 'string', example: '2 hours' },
          telecenter: { type: 'string', example: 'Damascus' },
        },
      },
      Assessment: {
        type: 'object',
        properties: {
          course: { type: 'string', example: 'CS101' },
          startTime: { type: 'string', example: '2024-05-01 09:00' },
          endTime: { type: 'string', example: '2024-05-01 11:00' },
          status: { type: 'string', example: 'Done', description: 'Archive, Done, Checking, etc.' },
          score: { type: 'number', nullable: true, example: 85 },
          alert: { type: 'string', nullable: true, example: 'alert' },
        },
      },
      StudentClass: {
        type: 'object',
        properties: {
          course: { type: 'string', example: 'CS101' },
          term: { type: 'string', example: 'Spring 2024' },
          class: { type: 'string', example: 'A' },
          tutor: { type: 'string', example: 'Dr. Smith' },
          email: { type: 'string', example: 't_example', description: 'Raw Tutor mail column; SVUIS may publish a login instead of an email address' },
          sessionTime: { type: 'string', example: 'Saturday_20:00_22:00' },
        },
      },
      TutorGroup: {
        type: 'object',
        properties: {
          group: { type: 'string', example: 'Software Engineering - Year 3' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                course: { type: 'string', example: 'CS101' },
                class: { type: 'string', example: 'A' },
                tutor: { type: 'string', example: 'Dr. Smith' },
                percent: { type: 'string', example: '75%' },
              },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'Invalid username or password' },
          meta: {
            type: 'object',
            properties: {
              cached: { type: 'boolean', example: false },
              fetchedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
  security: [{ cookieAuth: [] }],
};

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./routes/*.{ts,js}', './index.{ts,js}'].map(pattern => fileURLToPath(new URL(pattern, import.meta.url)).replace(/\\/g, '/')),
};

export const swaggerSpec = swaggerJsdoc(options);

import docx
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, Inches

def add_heading(doc, text, level=1, align=WD_ALIGN_PARAGRAPH.LEFT):
    heading = doc.add_heading(text, level=level)
    heading.alignment = align
    return heading

def add_paragraph(doc, text, align=WD_ALIGN_PARAGRAPH.JUSTIFY, bold=False, italic=False):
    p = doc.add_paragraph()
    p.alignment = align
    run = p.add_run(text)
    run.bold = bold
    run.italic = italic
    return p

doc = docx.Document()

# Styles
style = doc.styles['Normal']
font = style.font
font.name = 'Times New Roman'
font.size = Pt(13)

# 1. SUMMARY
add_heading(doc, 'SUMMARY', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, 'Topic title: SQLTuner: AI Assistant for Automating Database Performance Optimization')
add_paragraph(doc, 'Student name: Nguyen Le Quoc Huy                       Student ID: 102220191')
add_paragraph(doc, 'Class: 22Nh16')
add_paragraph(doc, 'This graduation project researches and develops SQLTuner, an AI assistant system that automates the process of generating, optimizing, and evaluating SQL queries. By leveraging Local Large Language Models (LLMs), the system translates natural language queries into executable SQL commands. Furthermore, it analyzes execution plans to propose performance optimizations. The project also introduces a comprehensive evaluation framework using standard benchmarks (Spider, BIRD) and a secure sandbox environment to measure model accuracy based on Execution Accuracy (EX) and Exact Match (EM) metrics. The results demonstrate the system\'s high stability, capability to optimize complex queries, and secure execution.')
doc.add_page_break()

# 2. GRADUATION PROJECT REQUIREMENTS
add_heading(doc, 'GRADUATION PROJECT REQUIREMENTS', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, 'Student Name: Nguyen Le Quoc Huy\t\tStudent ID: 102220191')
add_paragraph(doc, 'Class: 22Nh16\tFaculty: Information Technology\tMajor: Information Technology')
add_paragraph(doc, 'Topic title:')
add_paragraph(doc, 'SQLTuner: AI Assistant for Automating Database Performance Optimization')
add_paragraph(doc, 'Project topic: has signed intellectual property agreement for final result')
add_paragraph(doc, 'Initial figure and data:')
add_paragraph(doc, '[Note: Need to supplement initial figure and data]')
add_paragraph(doc, 'Content of the explanations and calculations:')
add_paragraph(doc, '[Note: Need to supplement content of explanations and calculations]')
add_paragraph(doc, 'Drawings, charts (specify the types and sizes of drawings):')
add_paragraph(doc, '[Note: Need to supplement drawings and charts]')
add_paragraph(doc, 'Date of assignment: [Note: Need to supplement assignment date]')
add_paragraph(doc, 'Date of completion: [Note: Need to supplement completion date]')
doc.add_page_break()

# 3. PREFACE
add_heading(doc, 'PREFACE', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, '[Note: Need to supplement Preface / Acknowledgements]')
doc.add_page_break()

# 4. ASSURANCE
add_heading(doc, 'ASSURANCE', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, '[Note: Need to supplement Assurance statement for academic integrity]')
add_paragraph(doc, '\n\nStudent Performed\n[Signature and Full Name]')
doc.add_page_break()

# 5. TABLE OF CONTENT
add_heading(doc, 'TABLE OF CONTENT', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, '[Note: Need to auto-generate or supplement Table of Content structure]')
doc.add_page_break()

# 6. LIST OF TABLES, PICTURES
add_heading(doc, 'LIST OF TABLES, PICTURES', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, '[Note: Need to supplement List of Tables and Pictures based on the added content]')
doc.add_page_break()

# 7. LIST OF SYMBOL, ACRONYM
add_heading(doc, 'LIST OF SYMBOL, ACRONYM', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, 'ACRONYM:')
add_paragraph(doc, 'AI: Artificial Intelligence')
add_paragraph(doc, 'DBA: Database Administrator')
add_paragraph(doc, 'DDL: Data Definition Language')
add_paragraph(doc, 'DML: Data Manipulation Language')
add_paragraph(doc, 'EM: Exact Match')
add_paragraph(doc, 'EX: Execution Accuracy')
add_paragraph(doc, 'LLM: Large Language Model')
add_paragraph(doc, 'NLP: Natural Language Processing')
add_paragraph(doc, 'OOM: Out of Memory')
add_paragraph(doc, 'RDBMS: Relational Database Management System')
add_paragraph(doc, 'SPA: Single Page Application')
add_paragraph(doc, 'SQL: Structured Query Language')
doc.add_page_break()

# 8. INTRODUCTION
add_heading(doc, 'INTRODUCTION', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, 'In the era of digitalization and big data management, Structured Query Language (SQL) plays a crucial role in extracting information from Relational Database Management Systems (RDBMS), particularly PostgreSQL. However, building, testing, and optimizing complex SQL commands often requires significant time and deep technical expertise from Data Engineers and Backend Developers.')
add_paragraph(doc, 'The rise of Large Language Models (LLMs) has opened a new direction for automating SQL generation (Text-to-SQL). Nevertheless, current solutions still lack performance optimization, automated evaluation frameworks, and regression control.')
add_paragraph(doc, 'Therefore, this project aims to build SQLTuner – a comprehensive platform that integrates three core processes: Intelligent Query Generation, Performance Optimization based on actual execution plans, and Automated Batch Evaluation to manage the model\'s quality lifecycle.')
doc.add_page_break()

# 9. CHAPTER 1
add_heading(doc, 'CHAPTER 1: THEORETICAL BASIS', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, 'This chapter presents the core theoretical foundations for researching and developing the project, including the evolution of the Text-to-SQL problem, the intervention of Large Language Models (LLMs) in database interaction, and standard evaluation benchmarks.')

add_heading(doc, '1.1. Overview of the Text-to-SQL Problem', level=2)
add_heading(doc, '1.1.1. Concept and Role', level=3)
add_paragraph(doc, 'Text-to-SQL is an important problem in Natural Language Processing (NLP) combined with Databases. The goal is to automate the translation of natural language questions into valid and executable SQL queries. It acts as a bridge, removing technical barriers for end-users.')
add_heading(doc, '1.1.2. Core Challenges', level=3)
add_paragraph(doc, 'The main challenges include Ambiguity in natural language, Schema Linking, Complex Query Structures (nested queries, multiple JOINs), and Cross-domain Generalization (zero-shot environments).')

add_heading(doc, '1.2. Application of Large Language Models (LLMs) in Databases', level=2)
add_heading(doc, '1.2.1. Code Generation Capabilities', level=3)
add_paragraph(doc, 'Modern LLMs trained on massive datasets possess excellent logical reasoning and code generation capabilities, learning the relationship between natural language and SQL syntax.')
add_heading(doc, '1.2.2. Optimization via Prompt Engineering', level=3)
add_paragraph(doc, 'Techniques like providing Metadata (DDL), Few-shot prompting, and Chain-of-Thought are used to guide the LLM to generate precise SQL queries.')
add_heading(doc, '1.2.3. Query Optimization', level=3)
add_paragraph(doc, 'LLMs are used to analyze bottlenecks from Execution Plans (EXPLAIN) and propose optimizations like rewriting JOINs or adding Indexes.')

add_heading(doc, '1.3. Evaluation Benchmarks', level=2)
add_paragraph(doc, 'The project utilizes two academic benchmarks: Spider (cross-domain, zero-shot) and BIRD (large-scale, database-grounded, messy data). The core evaluation metrics are Execution Accuracy (EX) and Exact Match (EM).')

add_heading(doc, '1.4. Conclusion of Chapter 1', level=2)
add_paragraph(doc, 'Chapter 1 provided a comprehensive overview of the Text-to-SQL theoretical basis, challenges, LLM potential, and evaluation metrics, setting the premise for the system design in Chapter 2.')
doc.add_page_break()

# 10. CHAPTER 2
add_heading(doc, 'CHAPTER 2: SYSTEM ANALYSIS AND DESIGN', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_heading(doc, '2.1. Problem Statement', level=2)
add_paragraph(doc, 'The project addresses the need for an integrated framework for Text-to-SQL generation, query optimization, and batch evaluation.')
add_heading(doc, '2.2. Current Situation Analysis', level=2)
add_paragraph(doc, 'Current tools lack connection with the actual database state and do not have an automated accuracy verification process for large-scale datasets.')
add_heading(doc, '2.3. Functional Analysis', level=2)
add_paragraph(doc, 'The system targets Backend Developers/DBAs and AI Researchers/Data Engineers. Core modules include Text-to-SQL Generation, SQL Optimization, Automated Evaluation Module (Batch Inference, Evaluation Engine), and Database Simulation (Sandbox) for secure execution.')
add_heading(doc, '2.4. Database Design', level=2)
add_paragraph(doc, 'The relational database manages users, connection configurations (db_connections), interaction logs (query_logs), and performance analysis (performance_analysis).')
add_heading(doc, '2.5. System Construction', level=2)
add_paragraph(doc, 'The project uses a modular architecture with a Python/FastAPI Backend, PostgreSQL database, React/TypeScript Frontend, and Docker/Cloud Run deployment. The Evaluation Pipeline handles asynchronous inference and secure sandbox execution.')
add_heading(doc, '2.6. Conclusion of Chapter 2', level=2)
add_paragraph(doc, 'Chapter 2 detailed the functional analysis, database design, and pipeline workflow, establishing the blueprint for the implementation in Chapter 3.')
doc.add_page_break()

# 11. CHAPTER 3
add_heading(doc, 'CHAPTER 3: DEPLOYMENT AND EVALUATION RESULTS', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_heading(doc, '3.1. Deployment Model', level=2)
add_paragraph(doc, 'The system is containerized using Docker, with independent deployment for the Local LLM module. Tools used include VS Code, Swagger UI, and PgAdmin4. Configuration involves Model Selection, Generation Parameters, and Batch Processing limits.')
add_heading(doc, '3.2. Experimental Results', level=2)
add_paragraph(doc, 'Experiments validated the system across 5 scenarios: Basic Text-to-SQL Generation, Complex Query Optimization, Batch Execution on Benchmarks (handling OOM gracefully), Evaluation Report Extraction, and Secure Execution with Database Simulation (catching destructive queries).')
add_heading(doc, '3.3. Result Evaluation Remarks', level=2)
add_paragraph(doc, 'SQLTuner demonstrated high stability, practical optimization capabilities, and a superior Evaluation Framework for measuring Local LLM performance on large schemas offline securely.')
doc.add_page_break()

# 12. CONCLUSION
add_heading(doc, 'CONCLUSION AND FUTURE DIRECTIONS', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_heading(doc, '1. Achieved Results', level=2)
add_paragraph(doc, 'The project successfully built a comprehensive architecture integrating Local LLMs for Text-to-SQL and optimization while ensuring data privacy. The core contribution is the quantitative Evaluation Framework with Sandbox execution, measuring EX and EM metrics accurately.')
add_heading(doc, '2. Recommendations and Future Directions', level=2)
add_paragraph(doc, 'Future work includes expanding Multi-DBMS support, optimizing multiprocessing/asynchronous queues for faster batch inference, implementing Retrieval-Augmented Generation (RAG) for large enterprise Schema Linking, and integrating continuous learning via Fine-tuning (LoRA/QLoRA) using system logs.')
doc.add_page_break()

# 13. REFERENCES
add_heading(doc, 'REFERENCES', level=1, align=WD_ALIGN_PARAGRAPH.CENTER)
add_paragraph(doc, '[1] Information Technology specialized teaching materials, Da Nang University of Science and Technology.')
add_paragraph(doc, '[2] Jinyang Li, Binyuan Hui et al. (2024), BIRD: A Big Bench for Large-Scale Database Grounded Text-to-SQLs, NeurIPS.')
add_paragraph(doc, '[3] Tao Yu, Rui Zhang et al. (2018), Spider: A Large-Scale Human-Labeled Dataset for Complex and Cross-Domain Semantic Parsing and Text-to-SQL Task, EMNLP.')
add_paragraph(doc, '[4] Sebastián Ramírez (2024), FastAPI Documentation, https://fastapi.tiangolo.com/.')

doc.save('e:/SQLTuner/reports/PL04_Nguyen_Le_Quoc_Huy.docx')
print("Document saved successfully!")

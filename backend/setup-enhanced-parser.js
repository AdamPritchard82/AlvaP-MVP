// Enhanced CV Parser Setup Script
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class EnhancedParserSetup {
  constructor() {
    this.rootDir = __dirname;
    this.logsDir = path.join(this.rootDir, 'logs');
    this.tempDir = path.join(this.rootDir, 'temp');
    this.testDir = path.join(this.rootDir, 'test', 'data');
  }

  async setup() {
    console.log('🚀 Setting up Enhanced CV Parser System');
    console.log('='.repeat(50));

    try {
      // Create necessary directories
      await this.createDirectories();

      // Check dependencies
      await this.checkDependencies();

      // Setup configuration
      await this.setupConfiguration();

      // Run tests
      await this.runTests();

      // Generate summary
      this.generateSummary();

      console.log('\n✅ Setup completed successfully!');
      console.log('\n📖 Next steps:');
      console.log('   1. Start the server: node enhanced-cv-server.js');
      console.log('   2. Or use: start-enhanced-server.bat (Windows)');
      console.log('   3. Test with: node benchmark-cv-parser.js');
      console.log('   4. Read docs: backend/docs/CV_PARSER_README.md');

    } catch (error) {
      console.error('\n❌ Setup failed:', error.message);
      process.exit(1);
    }
  }

  async createDirectories() {
    console.log('\n📁 Creating directories...');

    const dirs = [
      this.logsDir,
      this.tempDir,
      this.testDir
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`   ✅ Created: ${path.relative(this.rootDir, dir)}`);
      } else {
        console.log(`   ✓ Exists: ${path.relative(this.rootDir, dir)}`);
      }
    }
  }

  async checkDependencies() {
    console.log('\n📦 Checking dependencies...');

    const requiredPackages = [
      'express',
      'multer',
      'cors',
      'pdf-parse',
      'mammoth',
      'textract',
      'tesseract.js',
      'docx'
    ];

    const packageJson = JSON.parse(fs.readFileSync(path.join(this.rootDir, 'package.json'), 'utf8'));
    const installedPackages = Object.keys(packageJson.dependencies || {});

    for (const pkg of requiredPackages) {
      if (installedPackages.includes(pkg)) {
        console.log(`   ✅ ${pkg}`);
      } else {
        console.log(`   ❌ ${pkg} - NOT INSTALLED`);
        throw new Error(`Missing required package: ${pkg}`);
      }
    }

    // Check Node.js version
    const nodeVersion = process.version;
    console.log(`   📋 Node.js version: ${nodeVersion}`);

    if (parseInt(nodeVersion.slice(1).split('.')[0]) < 14) {
      console.log('   ⚠️  Warning: Node.js 14+ recommended');
    }
  }

  async setupConfiguration() {
    console.log('\n⚙️  Setting up configuration...');

    // Check if .env exists
    const envFile = path.join(this.rootDir, '.env');
    const envExampleFile = path.join(this.rootDir, 'env.example');

    if (!fs.existsSync(envFile)) {
      if (fs.existsSync(envExampleFile)) {
        fs.copyFileSync(envExampleFile, envFile);
        console.log('   ✅ Created .env from env.example');
      } else {
        console.log('   ⚠️  No .env file found, using defaults');
      }
    } else {
      console.log('   ✓ .env file exists');
    }

    // Validate configuration
    try {
      const { config } = require('./src/config/config');
      config.validate();
      console.log('   ✅ Configuration validation passed');
    } catch (error) {
      console.log(`   ❌ Configuration validation failed: ${error.message}`);
      throw error;
    }
  }

  async runTests() {
    console.log('\n🧪 Running tests...');

    try {
      // Run basic tests
      const { CvParserTestSuite } = require('./test/test-cv-parser');
      const testSuite = new CvParserTestSuite();
      
      // Run configuration test only
      await testSuite.testConfiguration();
      
      console.log('   ✅ Basic tests passed');
    } catch (error) {
      console.log(`   ⚠️  Tests had issues: ${error.message}`);
    }
  }

  generateSummary() {
    console.log('\n📊 Setup Summary');
    console.log('='.repeat(30));

    // Check file structure
    const files = [
      'enhanced-cv-server.js',
      'src/parsers/simpleEnhancedCvParser.js',
      'src/utils/logger.js',
      'src/utils/errorHandler.js',
      'src/config/config.js',
      'test/test-cv-parser.js',
      'benchmark-cv-parser.js',
      'docs/CV_PARSER_README.md'
    ];

    console.log('\n📁 File Structure:');
    files.forEach(file => {
      const filePath = path.join(this.rootDir, file);
      if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}`);
      } else {
        console.log(`   ❌ ${file} - MISSING`);
      }
    });

    // Check directories
    const dirs = [
      'logs',
      'temp',
      'test/data',
      'src/parsers',
      'src/utils',
      'src/config',
      'docs'
    ];

    console.log('\n📂 Directories:');
    dirs.forEach(dir => {
      const dirPath = path.join(this.rootDir, dir);
      if (fs.existsSync(dirPath)) {
        console.log(`   ✅ ${dir}/`);
      } else {
        console.log(`   ❌ ${dir}/ - MISSING`);
      }
    });

    // Environment info
    console.log('\n🌍 Environment:');
    console.log(`   Node.js: ${process.version}`);
    console.log(`   Platform: ${process.platform}`);
    console.log(`   Architecture: ${process.arch}`);
    console.log(`   OCR Enabled: ${process.env.ENABLE_OCR === 'true'}`);
    console.log(`   Log Level: ${process.env.LOG_LEVEL || 'info'}`);
  }
}

// Run setup if called directly
if (require.main === module) {
  const setup = new EnhancedParserSetup();
  setup.setup().catch(console.error);
}

module.exports = { EnhancedParserSetup };




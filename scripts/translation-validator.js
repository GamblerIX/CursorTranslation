const fs = require('fs');
const path = require('path');

/**
 * 翻译验证器类
 * 用于检测未翻译的词条并创建缺失的翻译文件
 */
class TranslationValidator {
    constructor(options = {}) {
        this.translationsDir = path.join(__dirname, '..', 'translations');
        this.zhCnFile = path.join(this.translationsDir, 'zh-cn.json');
        this.noFile = path.join(this.translationsDir, 'no.json');
        this.missingTranslations = [];
        this.errorLog = [];
        this.quietMode = options.quiet || false;
    }

    /**
     * 日志工具
     */
    static log(level, message, quiet = false, isMainResult = false) {
        if (quiet && !isMainResult) {
            return;
        }
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 安全读取文件
     */
    safeReadFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                TranslationValidator.log('WARN', `文件不存在: ${filePath}`, this.quietMode);
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            TranslationValidator.log('INFO', `成功读取文件: ${filePath} (${content.length} 字符)`, this.quietMode);
            return content;
        } catch (error) {
            TranslationValidator.log('ERROR', `读取文件失败: ${filePath} - ${error.message}`, this.quietMode);
            this.errorLog.push({
                type: 'READ_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 安全写入文件
     */
    safeWriteFile(filePath, content) {
        try {
            // 确保目录存在
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                TranslationValidator.log('INFO', `创建目录: ${dir}`, this.quietMode);
            }

            fs.writeFileSync(filePath, content, 'utf-8');
            TranslationValidator.log('SUCCESS', `成功写入文件: ${filePath}`, this.quietMode);
            return true;
        } catch (error) {
            TranslationValidator.log('ERROR', `写入文件失败: ${filePath} - ${error.message}`, this.quietMode);
            this.errorLog.push({
                type: 'WRITE_ERROR',
                file: filePath,
                error: error.message
            });
            return false;
        }
    }

    /**
     * 解析JSON文件
     */
    parseJsonFile(filePath) {
        const content = this.safeReadFile(filePath);
        if (!content) {
            return null;
        }

        try {
            const parsed = JSON.parse(content);
            TranslationValidator.log('INFO', `成功解析JSON文件: ${filePath}`, this.quietMode);
            return parsed;
        } catch (error) {
            TranslationValidator.log('ERROR', `JSON解析失败: ${filePath} - ${error.message}`, this.quietMode);
            this.errorLog.push({
                type: 'JSON_PARSE_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 提取所有词条（包括已翻译和未翻译的）
     */
    extractAllTerms(translations) {
        const terms = [];
        
        const extractFromObject = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string') {
                    terms.push({
                        key: key,
                        value: value,
                        path: prefix ? `${prefix}.${key}` : key
                    });
                } else if (typeof value === 'object' && value !== null) {
                    extractFromObject(value, prefix ? `${prefix}.${key}` : key);
                }
            }
        };

        extractFromObject(translations);
        return terms;
    }

    /**
     * 扁平化翻译对象
     */
    flattenTranslations(obj, prefix = '') {
        const flattened = {};
        
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                Object.assign(flattened, this.flattenTranslations(value, prefix ? `${prefix}.${key}` : key));
            } else if (typeof value === 'string') {
                flattened[key] = value;
            }
        }
        
        return flattened;
    }

    /**
     * 检查词条是否已翻译
     * 如果包含中文字符，认为已翻译
     * 如果只包含英文字符、数字、符号等，认为未翻译
     */
    isTranslated(term) {
        // 检查是否包含中文字符
        const hasChinese = /[\u4e00-\u9fff]/.test(term.value);
        // 检查是否主要是英文内容（包含英文字母且长度大于2）
        const isEnglishContent = /[a-zA-Z]/.test(term.value) && term.value.length > 2;
        
        // 如果包含中文，认为已翻译
        if (hasChinese) {
            return true;
        }
        
        // 如果是纯英文内容且长度较长，可能是未翻译的
        if (isEnglishContent) {
            // 排除一些明显的技术术语或简短词汇
            const technicalTerms = ['API', 'URL', 'ID', 'AWS', 'IAM', 'JSON', 'HTML', 'CSS', 'JS', 'TS'];
            if (technicalTerms.includes(term.value.trim())) {
                return true; // 技术术语认为不需要翻译
            }
            return false; // 其他英文内容认为未翻译
        }
        
        // 其他情况（如纯符号、数字等）认为已翻译
        return true;
    }

    /**
     * 分析翻译文件
     */
    analyzeTranslations() {
        TranslationValidator.log('INFO', '开始分析翻译文件...', this.quietMode);
        
        const zhCnTranslations = this.parseJsonFile(this.zhCnFile);
        if (!zhCnTranslations) {
            TranslationValidator.log('ERROR', '无法读取 zh-cn.json 文件', this.quietMode);
            return false;
        }

        const allTerms = this.extractAllTerms(zhCnTranslations);
        this.allTermsCount = allTerms.length;
        TranslationValidator.log('INFO', `找到 ${allTerms.length} 个总词条`, this.quietMode);

        // 检查现有翻译文件中未翻译的词条
        const existingUntranslated = allTerms.filter(term => !this.isTranslated(term));
        
        // 检查缺失的常见英文词条
        const commonEnglishTerms = [
            'Page Down', 'Page Up', 'Forward', 'Back', 'Tools', 'View', 'Help',
            'File', 'Edit', 'Selection', 'Go', 'Run', 'Terminal', 'Window',
            'Search', 'Replace', 'Find', 'Navigate', 'Debug', 'Extensions',
            'Settings', 'Preferences', 'General', 'Advanced', 'Basic',
            'Cancel', 'OK', 'Apply', 'Save', 'Close', 'Open', 'Delete',
            'Copy', 'Paste', 'Cut', 'Undo', 'Redo', 'Select All',
            'New File', 'New Folder', 'Rename', 'Move', 'Duplicate',
            'Import', 'Export', 'Upload', 'Download', 'Sync',
            'Login', 'Logout', 'Sign In', 'Sign Out', 'Account',
            'Profile', 'Dashboard', 'Home', 'About', 'Version',
            'Update', 'Upgrade', 'Install', 'Uninstall', 'Enable', 'Disable'
        ];
        
        const flatTranslations = this.flattenTranslations(zhCnTranslations);
        const missingCommonTerms = [];
        
        for (const term of commonEnglishTerms) {
            if (!flatTranslations[term]) {
                missingCommonTerms.push({
                    path: 'missing',
                    key: term,
                    value: term,
                    category: 'common'
                });
            }
        }
        
        // 合并两种类型的未翻译词条
        this.missingTranslations = [...existingUntranslated, ...missingCommonTerms];
        
        // 统计已翻译的词条
        const translatedTerms = allTerms.filter(term => this.isTranslated(term));
        TranslationValidator.log('INFO', `已翻译词条: ${translatedTerms.length} 个`, this.quietMode);
        TranslationValidator.log('INFO', `翻译完成度: ${((translatedTerms.length / (allTerms.length + missingCommonTerms.length)) * 100).toFixed(1)}%`, this.quietMode);
        
        TranslationValidator.log('INFO', `发现 ${this.missingTranslations.length} 个未翻译的词条`, this.quietMode);
        
        return true;
    }

    /**
     * 创建no.json文件
     * 参照zh-cn.json的结构，保持一致性
     */
    createNoJson() {
        const zhCnTranslations = this.parseJsonFile(this.zhCnFile);
        if (!zhCnTranslations) {
            TranslationValidator.log('ERROR', '无法读取 zh-cn.json 文件作为参照', this.quietMode);
            return false;
        }

        const allOriginalTerms = this.extractAllTerms(zhCnTranslations);
        const originalData = {};
        
        function extractOriginalTerms(obj, target) {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'object' && value !== null) {
                    target[key] = {};
                    extractOriginalTerms(value, target[key]);
                } else if (typeof value === 'string') {
                    target[key] = key;
                }
            }
        }
        
        extractOriginalTerms(zhCnTranslations, originalData);
        
        const jsonString = JSON.stringify(originalData, null, 2);
        
        if (this.safeWriteFile(this.noFile, jsonString)) {
            TranslationValidator.log('SUCCESS', `成功创建 no.json 文件，包含 ${allOriginalTerms.length} 个原始词条，其中 ${this.missingTranslations.length} 个未翻译`, this.quietMode);
            return true;
        } else {
            TranslationValidator.log('ERROR', '创建 no.json 文件失败', this.quietMode);
            return false;
        }
    }

    /**
     * 生成详细报告
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total_terms: this.allTermsCount || 0,
                missing_translations: this.missingTranslations.length,
                errors: this.errorLog.length
            },
            missing_translations: this.missingTranslations.map(term => ({
                path: term.path,
                english_text: term.value,
                category: term.path.split('.')[0]
            })),
            errors: this.errorLog,
            recommendations: [
                "检查 no.json 文件中的未翻译词条",
                "为未翻译的词条添加中文翻译",
                "将翻译添加到 zh-cn.json 文件中",
                "重新运行验证以确保所有词条都已翻译"
            ]
        };

        const reportFile = path.join(this.translationsDir, 'translation-report.json');
        this.safeWriteFile(reportFile, JSON.stringify(report, null, 2));
        
        TranslationValidator.log('INFO', `生成详细报告: ${reportFile}`, this.quietMode);
        return report;
    }

    /**
     * 主执行方法
     */
    run() {
        TranslationValidator.log('INFO', '开始翻译验证流程...', this.quietMode);
        
        try {
            // 分析翻译文件
            if (!this.analyzeTranslations()) {
                return false;
            }

            // 始终创建no.json文件，包含所有原始词条
            if (!this.createNoJson()) {
                return false;
            }

            // 生成报告
            const report = this.generateReport();
            
            // 输出摘要
            if (this.quietMode) {
                if (this.missingTranslations.length === 0) {
                    TranslationValidator.log('SUCCESS', `翻译验证通过 (${this.allTermsCount}个词条全部翻译完成)`, this.quietMode, true);
                } else {
                    TranslationValidator.log('ERROR', `翻译验证失败 (发现${this.missingTranslations.length}个未翻译词条)`, this.quietMode, true);
                }
            } else {
                TranslationValidator.log('SUCCESS', '翻译验证完成！');
                TranslationValidator.log('INFO', `发现 ${this.missingTranslations.length} 个未翻译词条`);
                TranslationValidator.log('INFO', `错误数量: ${this.errorLog.length}`);
                TranslationValidator.log('INFO', 'no.json 文件已更新，包含所有原始英文词条');
                
                if (this.missingTranslations.length > 0) {
                    TranslationValidator.log('WARN', '请检查 no.json 文件中的未翻译词条');
                }
            }

            return true;
        } catch (error) {
            TranslationValidator.log('ERROR', `执行过程中发生错误: ${error.message}`);
            this.errorLog.push({
                type: 'RUNTIME_ERROR',
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }
}

/**
 * 命令行入口
 */
function main() {
    const args = process.argv.slice(2);
    const quietMode = args.includes('--quiet') || args.includes('-q');
    
    const validator = new TranslationValidator({ quiet: quietMode });
    const success = validator.run();
    
    if (!success) {
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main();
}

module.exports = TranslationValidator;
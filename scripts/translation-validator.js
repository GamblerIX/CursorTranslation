const fs = require('fs');
const path = require('path');

/**
 * 翻译验证器类
 * 用于检测未翻译的词条并创建缺失的翻译文件
 */
class TranslationValidator {
    constructor() {
        this.translationsDir = path.join(__dirname, '..', 'translations');
        this.zhCnFile = path.join(this.translationsDir, 'zh-cn.json');
        this.noFile = path.join(this.translationsDir, 'no.json');
        this.missingTranslations = [];
        this.errorLog = [];
    }

    /**
     * 日志工具
     */
    static log(level, message) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [${level}] ${message}`);
    }

    /**
     * 安全读取文件
     */
    safeReadFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) {
                TranslationValidator.log('WARN', `文件不存在: ${filePath}`);
                return null;
            }
            const content = fs.readFileSync(filePath, 'utf-8');
            TranslationValidator.log('INFO', `成功读取文件: ${filePath} (${content.length} 字符)`);
            return content;
        } catch (error) {
            TranslationValidator.log('ERROR', `读取文件失败: ${filePath} - ${error.message}`);
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
                TranslationValidator.log('INFO', `创建目录: ${dir}`);
            }

            fs.writeFileSync(filePath, content, 'utf-8');
            TranslationValidator.log('SUCCESS', `成功写入文件: ${filePath}`);
            return true;
        } catch (error) {
            TranslationValidator.log('ERROR', `写入文件失败: ${filePath} - ${error.message}`);
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
            TranslationValidator.log('INFO', `成功解析JSON文件: ${filePath}`);
            return parsed;
        } catch (error) {
            TranslationValidator.log('ERROR', `JSON解析失败: ${filePath} - ${error.message}`);
            this.errorLog.push({
                type: 'JSON_PARSE_ERROR',
                file: filePath,
                error: error.message
            });
            return null;
        }
    }

    /**
     * 提取所有英文词条
     */
    extractEnglishTerms(translations) {
        const terms = [];
        
        const extractFromObject = (obj, prefix = '') => {
            for (const [key, value] of Object.entries(obj)) {
                if (typeof value === 'string') {
                    // 检查是否为英文（包含英文字母）
                    if (/[a-zA-Z]/.test(value)) {
                        terms.push({
                            key: prefix ? `${prefix}.${key}` : key,
                            value: value,
                            path: prefix ? `${prefix}.${key}` : key
                        });
                    }
                } else if (typeof value === 'object' && value !== null) {
                    extractFromObject(value, prefix ? `${prefix}.${key}` : key);
                }
            }
        };

        extractFromObject(translations);
        return terms;
    }

    /**
     * 检查词条是否已翻译
     */
    isTranslated(term) {
        // 检查是否包含中文字符
        return /[\u4e00-\u9fff]/.test(term.value);
    }

    /**
     * 分析翻译文件
     */
    analyzeTranslations() {
        TranslationValidator.log('INFO', '开始分析翻译文件...');
        
        const zhCnTranslations = this.parseJsonFile(this.zhCnFile);
        if (!zhCnTranslations) {
            TranslationValidator.log('ERROR', '无法读取 zh-cn.json 文件');
            return false;
        }

        const englishTerms = this.extractEnglishTerms(zhCnTranslations);
        TranslationValidator.log('INFO', `找到 ${englishTerms.length} 个英文词条`);

        // 检查未翻译的词条
        this.missingTranslations = englishTerms.filter(term => !this.isTranslated(term));
        
        TranslationValidator.log('INFO', `发现 ${this.missingTranslations.length} 个未翻译的词条`);
        
        return true;
    }

    /**
     * 创建no.json文件
     * 参照zh-cn.json的结构，保持一致性
     */
    createNoJson() {
        if (this.missingTranslations.length === 0) {
            TranslationValidator.log('INFO', '没有发现未翻译的词条，无需创建 no.json');
            return true;
        }

        // 读取原始zh-cn.json文件，用于参照结构
        const zhCnTranslations = this.parseJsonFile(this.zhCnFile);
        if (!zhCnTranslations) {
            TranslationValidator.log('ERROR', '无法读取 zh-cn.json 文件作为参照');
            return false;
        }

        // 创建与zh-cn.json结构一致的对象
        const referenceStructure = JSON.parse(JSON.stringify(zhCnTranslations));
        
        // 清空所有值，只保留未翻译的词条
        const clearValues = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    clearValues(obj[key]);
                } else {
                    obj[key] = null; // 先清空所有值
                }
            }
        };
        
        clearValues(referenceStructure);
        
        // 填充未翻译的词条
        this.missingTranslations.forEach(term => {
            const parts = term.path.split('.');
            const category = parts[0];
            const key = parts.slice(1).join('.');
            
            if (referenceStructure[category] && key) {
                referenceStructure[category][key] = term.value;
            } else if (category && !key) {
                referenceStructure[category] = term.value;
            }
        });
        
        // 移除空分类
        const cleanEmptyCategories = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    cleanEmptyCategories(obj[key]);
                    
                    // 检查是否为空对象
                    if (Object.keys(obj[key]).length === 0) {
                        delete obj[key];
                    }
                } else if (obj[key] === null) {
                    delete obj[key];
                }
            }
        };
        
        cleanEmptyCategories(referenceStructure);
        
        // 按分类组织未翻译的词条（用于统计）
        const organizedTranslations = {};
        
        this.missingTranslations.forEach(term => {
            const parts = term.path.split('.');
            const category = parts[0];
            const key = parts.slice(1).join('.');
            
            if (!organizedTranslations[category]) {
                organizedTranslations[category] = {};
            }
            
            organizedTranslations[category][key] = term.value;
        });

        // 创建no.json内容
        const noJsonContent = {
            "metadata": {
                "created_at": new Date().toISOString(),
                "source_file": "zh-cn.json",
                "missing_translations_count": this.missingTranslations.length,
                "description": "未翻译的词条，需要手动翻译"
            },
            "translations": referenceStructure,
            "statistics": {
                "total_missing": this.missingTranslations.length,
                "categories": Object.keys(organizedTranslations).length,
                "categories_breakdown": Object.entries(organizedTranslations).map(([category, terms]) => ({
                    category: category,
                    count: Object.keys(terms).length
                }))
            }
        };

        const jsonString = JSON.stringify(noJsonContent, null, 2);
        
        if (this.safeWriteFile(this.noFile, jsonString)) {
            TranslationValidator.log('SUCCESS', `成功创建 no.json 文件，包含 ${this.missingTranslations.length} 个未翻译词条`);
            return true;
        } else {
            TranslationValidator.log('ERROR', '创建 no.json 文件失败');
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
                total_terms: this.missingTranslations.length + (this.missingTranslations.length > 0 ? this.missingTranslations.length : 0),
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
        
        TranslationValidator.log('INFO', `生成详细报告: ${reportFile}`);
        return report;
    }

    /**
     * 主执行方法
     */
    run() {
        TranslationValidator.log('INFO', '开始翻译验证流程...');
        
        try {
            // 分析翻译文件
            if (!this.analyzeTranslations()) {
                return false;
            }

            // 创建no.json文件
            if (!this.createNoJson()) {
                return false;
            }

            // 生成报告
            const report = this.generateReport();
            
            // 输出摘要
            TranslationValidator.log('SUCCESS', '翻译验证完成！');
            TranslationValidator.log('INFO', `发现 ${this.missingTranslations.length} 个未翻译词条`);
            TranslationValidator.log('INFO', `错误数量: ${this.errorLog.length}`);
            
            if (this.missingTranslations.length > 0) {
                TranslationValidator.log('WARN', '请检查 no.json 文件中的未翻译词条');
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
    const validator = new TranslationValidator();
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
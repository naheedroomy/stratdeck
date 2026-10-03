import tseslint from 'typescript-eslint';
export default tseslint.config(...tseslint.configs.recommended,{files:['src/**/*.ts','test/**/*.ts','web/**/*.tsx'],rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}]}},{ignores:['dist/**','public/**','node_modules/**']});

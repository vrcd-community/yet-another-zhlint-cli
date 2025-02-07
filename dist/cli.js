#!/usr/bin/env node
import{program as e}from"commander";e.name("yet-another-zhlint-cli").description("Yet another zhlint CLI").version(process.env.npm_package_version??"snapshot"),e.argument("<file-pattern>").option("--fix","fix all possibly found errors"),e.parse(),console.log("test");
